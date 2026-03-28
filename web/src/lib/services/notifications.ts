import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { createServiceClient } from "@/lib/supabase/service";

const expo = new Expo();

export interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown> | null;
}

export class NotificationService {
  /**
   * Queue a notification in the database WITHOUT sending push notification
   * Use this for hearing reminders that should be deduplicated and sent later
   */
  static async queue(payload: NotificationPayload) {
    const supabase = createServiceClient();

    console.log(`📥 [NotificationService] Queuing notification for user ${payload.user_id}: ${payload.title}`);

    const { data: dbNotif, error: dbError } = await supabase
      .from("notifications")
      .insert({
        user_id: payload.user_id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        category: payload.category || "admin",
        metadata: payload.metadata || {},
        is_read: false,
        push_sent: false // Mark as not sent yet
      })
      .select()
      .single();

    if (dbError) {
      console.error("❌ [NotificationService] Failed to queue notification:", dbError);
      return { success: false, error: dbError };
    }

    console.log(`✅ [NotificationService] Notification queued (ID: ${dbNotif.id})`);
    return { success: true, notification_id: dbNotif.id };
  }

  /**
   * Create a notification in the database and send a push notification to mobile immediately
   * Use this for admin broadcasts and urgent notifications
   */
  static async send(payload: NotificationPayload) {
    const supabase = createServiceClient();

    console.log(`🔔 [NotificationService] Sending notification to user ${payload.user_id}: ${payload.title}`);

    // 1. Persist to Database
    const { data: dbNotif, error: dbError } = await supabase
      .from("notifications")
      .insert({
        user_id: payload.user_id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        category: payload.category || "admin",
        metadata: payload.metadata || {},
        is_read: false,
        push_sent: true // Mark as sent immediately
      })
      .select()
      .single();

    if (dbError) {
      console.error("❌ [NotificationService] Database insertion failed:", dbError);
      // Even if DB save fails, we still try to send the Push so the user gets the alert
    }

    // 2. Send push notification
    // If DB insert failed, we construct a transient notification object for the push service
    const pushPayload = dbNotif || {
      id: "transient-" + Date.now(),
      user_id: payload.user_id,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      metadata: payload.metadata || {}
    };

    const pushResult = await this.sendPushNotification(pushPayload);

    return { 
      success: pushResult.success, 
      db: !!dbNotif, 
      push: pushResult.push,
      error: dbError?.message 
    };
  }

  /**
   * Process queued notifications (called by cron jobs)
   * dateTarget: 'tomorrow' → Evening cron sends reminders the night before
   *             'today'    → Morning cron sends reminders the morning of the hearing
   */
  static async processQueue(dateTarget: 'today' | 'tomorrow' = 'tomorrow') {
    const supabase = createServiceClient();

    console.log(`🔄 [NotificationService] Processing ${dateTarget} queue...`);

    // Get the target date in IST (YYYY-MM-DD)
    const getTargetDate = () => {
      const d = new Date();
      if (dateTarget === 'tomorrow') d.setDate(d.getDate() + 1);
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    };

    const targetDate = getTargetDate();

    console.log(`🔍 [NotificationService] Querying for: category=hearing_reminder, push_sent=false, hearing_date=${targetDate}`);

    // Fetch all unsent hearing reminders for the target date
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select('*')
      .eq('category', 'hearing')
      .eq('push_sent', false)
      // Use the arrow operator in a way that is most compatible with PostgREST
      .filter('metadata->>hearing_date', 'eq', targetDate);

    if (error) {
      console.error("❌ [NotificationService] Failed to fetch queued notifications:", error);
      return { success: false, error };
    }

    if (!notifications || notifications.length === 0) {
      console.log(`ℹ️ [NotificationService] No queued notifications found for ${dateTarget} (${targetDate})`);
      
      // OPTIONAL: Log some recent notifications to see what's in there
      const { data: recent } = await supabase.from('notifications').select('category, metadata').limit(5);
      console.log('📝 [NotificationService] Recent notifications in DB:', JSON.stringify(recent));
      
      return { success: true, processed: 0, duplicates: 0 };
    }

    console.log(`📋 [NotificationService] Found ${notifications.length} queued notifications in DB`);

    // Deduplicate by user_id + case_id + hearing_date
    const uniqueMap = new Map<string, NotificationRow>();
    for (const notif of notifications) {
      const key = `${notif.user_id}_${notif.metadata?.case_id}_${notif.metadata?.hearing_date}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, notif);
      } else {
        // Mark duplicate as sent so it won't be processed again
        await supabase
          .from("notifications")
          .update({ push_sent: true })
          .eq('id', notif.id);
      }
    }

    console.log(`✨ [NotificationService] Deduplicated to ${uniqueMap.size} unique notifications`);

    // Send push notifications for unique notifications
    let sent = 0;
    for (const notif of uniqueMap.values()) {
      const result = await this.sendPushNotification(notif);
      if (result.success) {
        await supabase
          .from("notifications")
          .update({ push_sent: true })
          .eq('id', notif.id);
        sent++;
      }
    }

    console.log(`✅ [NotificationService] Processed ${sent} notifications successfully`);
    return { success: true, processed: sent, duplicates: notifications.length - uniqueMap.size };
  }

  /**
   * Send push notification for a specific notification record
   * Private helper method used by send() and processQueue()
   */
  private static async sendPushNotification(notification: NotificationRow) {
    const supabase = createServiceClient();

    // 1. Fetch User's Push Tokens
    const { data: tokens, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("token")
      .eq("user_id", notification.user_id);

    if (tokenError || !tokens || tokens.length === 0) {
      console.log(`⚠️ [NotificationService] No push tokens found for user ${notification.user_id}. Push skipped.`);
      return { success: true, push: false };
    }

    // 2. Prepare Push Messages
    const pushMessages: ExpoPushMessage[] = [];
    for (const { token } of tokens) {
      if (!Expo.isExpoPushToken(token)) {
        console.warn(`[NotificationService] Invalid push token: ${token}`);
        continue;
      }

      pushMessages.push({
        to: token,
        sound: "default",
        title: notification.title,
        body: notification.message,
        data: { 
            ...notification.metadata, 
            notification_id: notification.id,
            type: notification.type 
        },
        priority: "high",
        channelId: "default",
      });
    }

    if (pushMessages.length === 0) {
      return { success: true, push: false };
    }

    // 3. Send to Expo in chunks
    const chunks = expo.chunkPushNotifications(pushMessages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (err) {
        console.error("❌ [NotificationService] Expo Push Error:", err);
      }
    }

    console.log(`✅ [NotificationService] Push notifications dispatched to ${pushMessages.length} devices.`);
    return { success: true, push: true, recipient_count: pushMessages.length };
  }

  /**
   * Send a broadcast notification to a specific audience
   * This handles both database persistence and push delivery
   */
  static async broadcast(payload: {
    title: string;
    body: string;
    target_audience: "all" | "advocates" | "clients";
    sent_by?: string;
  }) {
    const supabase = createServiceClient();
    console.log(`📣 [NotificationService] Starting broadcast: ${payload.title} to ${payload.target_audience}`);

    // 1. Determine Target User IDs
    let targetUsersQuery = supabase.from("profiles").select("id");

    if (payload.target_audience === "advocates") {
      targetUsersQuery = targetUsersQuery.eq("role", "advocate");
    } else if (payload.target_audience === "clients") {
      targetUsersQuery = targetUsersQuery.eq("role", "client");
    }

    const { data: targetUsers, error: userError } = await targetUsersQuery;
    
    if (userError || !targetUsers || targetUsers.length === 0) {
      console.log("⚠️ [NotificationService] No users found for broadcast.");
      return { success: true, recipient_count: 0 };
    }

    const targetUserIds = targetUsers.map(u => u.id);

    // 2. Insert into Inbox (Database Notification History)
    const notificationsToCreate = targetUserIds.map((userId: string) => ({
      user_id: userId,
      title: payload.title,
      message: payload.body,
      type: "info",
      category: "admin",
      is_read: false,
      metadata: {
        target_audience: payload.target_audience,
        sent_by: payload.sent_by || "system"
      }
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notificationsToCreate);

    if (notifError) {
      console.error("❌ [NotificationService] Failed to persist broadcast:", notifError);
      return { success: false, error: notifError };
    }

    // 3. Fetch Push Tokens
    const { data: tokenRows } = await supabase
      .from("user_push_tokens")
      .select("token")
      .in("user_id", targetUserIds);

    const rawTokens = tokenRows?.map(r => r.token).filter(t => Expo.isExpoPushToken(t)) || [];
    const pushTokens = [...new Set(rawTokens)];

    if (pushTokens.length === 0) {
      console.log("⚠️ [NotificationService] No tokens found. Push skipped.");
      return { success: true, recipient_count: targetUsers.length, push_count: 0 };
    }

    // 4. Construct and Send Push Messages
    const pushMessages = pushTokens.map(token => ({
      to: token,
      sound: 'default' as const,
      title: payload.title,
      body: payload.body,
      priority: 'high' as const,
      data: { type: 'admin_broadcast' }
    }));

    let pushCount = 0;
    const chunks = expo.chunkPushNotifications(pushMessages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
        pushCount += chunk.length;
      } catch (error) {
        console.error("❌ [NotificationService] Expo Broadcast Error:", error);
      }
    }

    console.log(`✅ [NotificationService] Broadcast complete. Sent to ${targetUsers.length} users, ${pushCount} devices.`);
    return {
      success: true,
      recipient_count: targetUsers.length,
      push_count: pushCount
    };
  }
}

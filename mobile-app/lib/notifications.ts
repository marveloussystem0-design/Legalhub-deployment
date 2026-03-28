import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Configure how notifications behave when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function registerForPushNotificationsAsync() {
  console.log("🚀 STARTING PUSH REGISTRATION...");
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return;
    }

    // Check if running in Expo Go - WE ALLOW IT NOW FOR TESTING
    // But we warn if Project ID is missing (which is common in Expo Go without EAS)
    
    // Only attempt to get token if Project ID exists (for remote push)
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
      
    console.log("🔍 Checking EAS Project ID:", projectId || "MISSING");

    if (projectId) {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        token = tokenData.data;
        console.log("✅ Fetched Push Token:", token);
        
        // Sync to Database
        if (token) {
           await syncPushTokenToDatabase(token);
        }
        
      } catch (e) {
        console.log("Error fetching push token:", e);
      }
    } else {
      console.log("⚠️ Skipping Push Token fetch: No EAS Project ID configured.");
      console.log("👉 To fix: Run 'eas init' or add 'extra.eas.projectId' to app.json");
    }
  } else {
    // console.log('Must use physical device for Push Notifications');
  }

  return token;
}

// Helper to sync token to Supabase
async function syncPushTokenToDatabase(token: string) {
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: user.id,
        token: token,
        device_type: Platform.OS === 'ios' ? 'ios' : 'android',
        last_used_at: new Date().toISOString()
      }, { onConflict: 'user_id, token' });

    if (error) {
      // If table doesn't exist yet, ignore error silently (migration might be pending)
      console.log("Token sync skipped (backend not ready):", error.code);
    } else {
      console.log("✅ Push Token synced to server");
    }
  } catch (err) {
    console.log("Error syncing token:", err);
  }
}

export async function scheduleHearingNotification(
  caseData: any,
  hearingDate: string,
) {
  console.log("Scheduling notification for:", {
    id: caseData?.id,
    number: caseData?.case_number,
    title: caseData?.title,
    date: hearingDate,
  });

  const triggerDate = new Date(hearingDate);
  const now = new Date();

  // Don't schedule for past hearings
  if (triggerDate <= now) {
    console.log("Skipping past hearing:", hearingDate);
    return;
  }

  // Check if hearing is today - send immediate notification
  const isToday = triggerDate.toDateString() === now.toDateString();
  if (isToday) {
    const notificationTitle =
      caseData.title || caseData.case_number || "Hearing Today!";
    const notificationBody = `🏛️ You have a hearing TODAY for ${caseData.case_number || "your case"} at ${caseData.court_name || "Court"}\nTap to check details`;

    console.log("Sending immediate notification for today's hearing:", {
      title: notificationTitle,
      body: notificationBody,
    });

    // Send immediate notification (2 seconds from now)
    const immediateTime = new Date();
    immediateTime.setSeconds(immediateTime.getSeconds() + 2);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle,
        body: notificationBody,
        data: { caseId: caseData.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: immediateTime,
      },
    });
  }

  // 1. Schedule for 24 hours before (Morning Reminder)
  const reminder24h = new Date(triggerDate);
  reminder24h.setHours(9, 0, 0, 0); // 9 AM on the day of hearing
  // If we want 24h before, maybe 9 AM previous day?
  // Let's stick to "Day Of" morning reminder for high utility

  if (reminder24h > now) {
    const notificationTitle =
      caseData.title || caseData.case_number || "Upcoming Hearing";
    const notificationBody = `🏛️ Hearing: ${caseData.case_number || "Case"} at ${caseData.court_name || "Court"}
Tap to check status`;

    console.log("Scheduling morning notification:", {
      title: notificationTitle,
      body: notificationBody,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle,
        body: notificationBody,
        data: { caseId: caseData.id },
        sound: true, // Explicitly enable sound
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder24h,
      },
    });
  }

  // 2. Schedule for 1 Hour before (Urgent Reminder)
  // Assuming hearing time is not set, we default to 10 AM court start time
  // So 1 hour before is 9 AM.
  // If we have specific time, use that.

  // Let's add a "Day Before" reminder instead?
  const reminderDayBefore = new Date(triggerDate);
  reminderDayBefore.setDate(reminderDayBefore.getDate() - 1);
  reminderDayBefore.setHours(18, 0, 0, 0); // 6 PM evening before

  if (reminderDayBefore > now) {
    const notificationTitle =
      caseData.title || caseData.case_number || "Upcoming Hearing";
    const notificationBody = `📅 Tomorrow: Hearing for ${caseData.case_number || "your case"}
Preparing is key! Tap to review.`;

    console.log("Scheduling evening notification:", {
      title: notificationTitle,
      body: notificationBody,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationTitle,
        body: notificationBody,
        data: { caseId: caseData.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDayBefore,
      },
    });
  }
}

export async function scheduleTestNotification() {
  const { Alert } = await import("react-native");

  // Cancel any existing scheduled notifications to start clean
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  // --- Test 1: Evening Reminder (arrives in 60 seconds) ---
  const eveningTrigger = new Date(now);
  eveningTrigger.setSeconds(eveningTrigger.getSeconds() + 60);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌆 Evening Hearing Reminder",
      body: "You have a hearing TOMORROW. Tap to review your case.",
      data: { test: true, type: 'evening_reminder' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: eveningTrigger,
    },
  });

  // --- Test 2: Morning Reminder (arrives in 120 seconds) ---
  const morningTrigger = new Date(now);
  morningTrigger.setSeconds(morningTrigger.getSeconds() + 120);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🌅 Morning Hearing Reminder",
      body: "You have a hearing TODAY. Tap to check case details.",
      data: { test: true, type: 'morning_reminder' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: morningTrigger,
    },
  });

  console.log("✅ Two test notifications scheduled:",
    "\n  Evening → ", eveningTrigger.toLocaleTimeString(),
    "\n  Morning → ", morningTrigger.toLocaleTimeString()
  );

  Alert.alert(
    "Test Notifications Scheduled ✅",
    `You will receive:\n\n🌆 Evening Reminder in 1 minute\n🌅 Morning Reminder in 2 minutes\n\nClose the app now to verify they arrive in the background!`
  );
}

export async function syncHearingNotifications(hearings: any[], cases: any[]) {
  // Cancel all existing to avoid duplicates (brute force sync)
  await Notifications.cancelAllScheduledNotificationsAsync();

  console.log(`Syncing notifications for ${hearings.length} hearings...`);

  for (const hearing of hearings) {
    let caseData = cases.find((c) => c.id === hearing.case_id);

    // Fallback: If parent case not found in cases array, use the joined data from hearings query
    if (!caseData && hearing.cases) {
      console.log("Using fallback joined data for hearing:", hearing.id);
      caseData = {
        id: hearing.case_id,
        title: hearing.cases.title,
        case_number: hearing.cases.case_number,
        court_name: hearing.cases.court_name,
      };
    }

    if (caseData && hearing.hearing_date) {
      await scheduleHearingNotification(caseData, hearing.hearing_date);
    } else {
      console.warn(
        "Skipping notification: Missing case data for hearing",
        hearing.id,
      );
    }
  }
}

/**
 * Listen for admin broadcast notifications via Supabase Realtime
 * Call this function once on app launch
 */
export async function listenForAdminNotifications(onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void) {
  const { supabase } = await import("@/lib/supabase");

  console.log("🔔 Starting notification listener... [VERSION: V3-NO-FILTER]");
  if (onStatusChange) onStatusChange('connecting');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log("❌ No authenticated user, skipping notification listener");
    if (onStatusChange) onStatusChange('disconnected');
    return;
  }

  console.log("👤 User ID:", user.id);

  // Subscribe to realtime notifications
  console.log("🔌 Subscribing to notification inserts...");
  
  // Use a dynamic channel name to prevent "mismatch" errors from stale bindings
  const channelName = `user-connect-${user.id}-${Date.now()}`;
  console.log("🔌 Connecting to channel:", channelName);

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
      },
      async (payload) => {
        console.log("🎉 NOTIFICATION EVENT RECEIVED:", payload.new);

        const notification = payload.new as any;

        // Schedule immediate notification?
        // NO. The Server now sends a Push Notification for this event.
        // If we schedule locally too, we get DOUBLE notifications (Push + Local).
        // We will let the Push handle the alert.
        
        // However, we can perform in-app UI updates here (like standard toast or snackbar if we had one)
        console.log("⚡ Realtime update received (Alert handled by Push System)");
        
        /* 
        // LEGACY LOCAL ALERT - DISABLED TO PREVENT DUPLICATE
        // This is handled by Remote Push now.
        */
      },
    )
    .subscribe((status, err) => {
      console.log(`📡 Notification subscription status: ${status}`);
      
      if (status === "SUBSCRIBED") {
        if (onStatusChange) onStatusChange('connected');
        console.log("✅ Successfully subscribed to notifications!");
      } else if (status === "CLOSED") {
        if (onStatusChange) onStatusChange('disconnected');
        console.log("ℹ️ Notification channel closed");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (onStatusChange) onStatusChange('disconnected');
        console.error("❌ Subscription issue:", status, err);
      }
    });

  console.log("✅ Notification listener setup complete for user:", user.id);

  return channel;
}

# Phase 5 Testing Guide - AI Integration & Legal Knowledge Base

## 📋 Manual Testing Checklist

### 1. **AI Chat Assistant** 🤖

**Navigate to:** `http://localhost:3000/dashboard/ai-assistant`

#### Initial Load
- [ ] Page loads without errors
- [ ] AI assistant header displays with Sparkles icon
- [ ] Welcome message shows with 4 suggested prompts
- [ ] "New Chat" and "Chat History" tabs are visible

#### Basic Chat Functionality
- [ ] Click on a suggested prompt (e.g., "Explain Section 302 IPC")
- [ ] Message appears in chat as user message (amber background)
- [ ] Loading spinner appears while waiting for AI response
- [ ] AI response appears (gray background)
- [ ] Legal disclaimer appears at bottom after first message
- [ ] Messages auto-scroll to bottom

#### Custom Messages
- [ ] Type your own question: "What is the difference between IPC and CrPC?"
- [ ] Press Enter to send (or click Send button)
- [ ] AI responds with relevant legal information
- [ ] Conversation context is maintained (ask a follow-up question)

#### Error Handling
- [ ] Try sending an empty message (should be disabled)
- [ ] Check if error message appears if API fails

---

### 2. **Legal Knowledge Base** 📚

**Navigate to:** `http://localhost:3000/dashboard/knowledge-base`

#### Page Structure
- [ ] Page loads with three tabs: Acts & Statutes, Judgments, My Bookmarks
- [ ] Search bar is visible on each tab
- [ ] Filter button is present
- [ ] "Coming Soon" placeholders display correctly

#### Tab Navigation
- [ ] Switch between Acts, Judgments, and Bookmarks tabs
- [ ] Each tab shows appropriate content
- [ ] Bookmarks tab shows empty state with browse buttons

---

### 3. **API Endpoints Testing** 🔌

**Using Browser DevTools Network Tab:**

#### AI Chat API
- [ ] Open DevTools → Network tab
- [ ] Send a message in AI chat
- [ ] Check for POST request to `/api/ai/chat`
- [ ] Verify response status is 200
- [ ] Check response contains: `conversationId`, `message`, `usage`

#### Knowledge Base APIs
- [ ] Open `/api/knowledge-base/acts` in browser
- [ ] Should return: `{"data":[],"count":0}` (empty since no data seeded)
- [ ] Open `/api/knowledge-base/judgments`
- [ ] Should return: `{"data":[],"count":0}`

---

### 4. **Database Verification** 💾

**In Supabase Dashboard:**

#### Check Tables Created
- [ ] Go to Supabase → Table Editor
- [ ] Verify these tables exist:
  - `legal_acts`
  - `legal_sections`
  - `legal_judgments`
  - `legal_citations`
  - `legal_bookmarks`
  - `ai_conversations`
  - `ai_messages`
  - `ai_usage_logs`

#### Check AI Conversation Data
- [ ] After sending messages in AI chat
- [ ] Open `ai_conversations` table
- [ ] Should see a new conversation record with your user_id
- [ ] Open `ai_messages` table
- [ ] Should see your messages and AI responses
- [ ] Open `ai_usage_logs` table
- [ ] Should see usage records with token counts and cost estimates

#### Check RLS Policies
- [ ] Go to Supabase → Authentication → Policies
- [ ] Verify policies exist for all new tables
- [ ] Check that you can only see your own conversations/bookmarks

---

### 5. **Cost Tracking** 💰

#### AI Usage Monitoring
- [ ] Send 3-5 messages in AI chat
- [ ] Check `ai_usage_logs` table in Supabase
- [ ] Verify each entry has:
  - `tokens_used` (should be > 0)
  - `cost_estimate` (should be > 0.00)
  - `feature` = 'chat'
  - Your `user_id`

---

### 6. **Console Errors** 🐛

#### Check for Errors
- [ ] Open Browser DevTools → Console
- [ ] Navigate through AI Assistant page
- [ ] Send messages in chat
- [ ] Check for any red errors (warnings are okay)
- [ ] Verify no TypeScript errors in terminal where `npm run dev` is running

---

### 7. **UI/UX Quality** 🎨

#### Design & Responsiveness
- [ ] AI chat interface looks professional
- [ ] Colors match your app theme (amber/orange)
- [ ] Messages are readable and well-formatted
- [ ] Page is responsive (try resizing browser window)
- [ ] Icons display correctly (Sparkles, Send, etc.)

---

## 🎯 Expected Results

**If everything works correctly:**

1. ✅ AI responds to your legal questions with relevant information
2. ✅ Conversation history is saved in database
3. ✅ Usage costs are tracked automatically
4. ✅ No console errors
5. ✅ Knowledge base pages load (even if empty)
6. ✅ All database tables exist with proper policies

---

## ⚠️ Common Issues to Watch For

**If AI doesn't respond:**
- Check OpenAI API key is correct in `.env.local`
- Check browser console for errors
- Verify `OPENAI_API_KEY` environment variable is loaded (restart dev server if needed)

**If database errors occur:**
- Verify all 3 migrations were run in Supabase
- Check RLS policies are enabled
- Ensure you're logged in as a user

---

## 📝 Report Back

After testing, please note:
1. ✅ What worked perfectly
2. ⚠️ Any errors or issues you encountered
3. 💡 Any improvements or features you'd like

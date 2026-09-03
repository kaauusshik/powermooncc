# 🔧 Quick Fix Guide - Supabase 400 Bad Request Error

**Last Updated:** 2026-09-03 16:54 UTC

## ❌ The Problem

You're seeing this error:
```
https://pddybafnmwkdzlqdhvra.supabase.co/rest/v1/expenses?select=* 400 (Bad Request)
```

**Root Cause:** Invalid Supabase API key format in your `.env` file.

---

## ✅ The Fix (3 Steps - Takes 2 Minutes)

### Step 1: Get Your Correct API Key

1. Open this URL in your browser:
   ```
   https://supabase.com/dashboard/project/pddybafnmwkdzlqdhvra/settings/api
   ```

2. Scroll to **"Project API keys"** section

3. Find **"anon public"** key (NOT "service_role")

4. Click **"Copy"** button

5. Verify the copied key:
   - ✅ Starts with `eyJ`
   - ✅ Very long (~200 characters)
   - ✅ Contains dots (.) separating sections
   - ❌ Does NOT start with `sb_publishable_`

---

### Step 2: Update Your .env File

1. Open file: `frontend/.env`

2. Find this line:
   ```env
   REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
   ```

3. Replace `YOUR_ANON_KEY_HERE` with the key you copied

4. It should look like:
   ```env
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZHliYWZubXdrZHpscWRodnJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0NjA4MDAsImV4cCI6MjA0MTAzNjgwMH0.YOUR_SIGNATURE_HERE
   ```

5. **Save the file** (Ctrl+S)

---

### Step 3: Restart Your App

```bash
cd frontend
npm start
```

Wait for the app to reload completely.

---

## 🧪 How to Test

1. Open the app: http://localhost:3000

2. If you see an error in the console immediately:
   - ✅ Good! The validation caught the invalid key
   - Follow the error message instructions

3. If no error, try to:
   - Log in (or sign up if first time)
   - Navigate to any page
   - Add an expense

4. Check the browser console (F12):
   - ✅ No 400 errors = Fixed!
   - ❌ Still seeing 400? See troubleshooting below

---

## 🔍 Troubleshooting

### Error: "Supabase URL or Key is missing"
- The `.env` file wasn't saved properly
- Make sure you saved after editing
- Restart the app

### Error: "Invalid Supabase API key format"
- You're still using `sb_publishable_...` 
- Go back to Step 1 and copy the correct key
- Make sure you copied **"anon public"** not "service_role"

### Still getting 400 Bad Request?
Check these:

1. **Did you restart the app?**
   - Changes to `.env` only apply after restart
   - Stop the app (Ctrl+C) and run `npm start` again

2. **Is the database set up?**
   - Go to: https://supabase.com/dashboard/project/pddybafnmwkdzlqdhvra
   - Click "Table Editor"
   - Check if `expenses` table exists
   - If not, run `supabase/migration.sql` (see Database Setup below)

3. **Clear browser cache**
   - Press Ctrl+Shift+Delete
   - Clear "Cached images and files"
   - Refresh the page

---

## 📊 Database Setup (If Tables Don't Exist)

If you see "relation 'expenses' does not exist":

1. Go to: https://supabase.com/dashboard/project/pddybafnmwkdzlqdhvra

2. Click **"SQL Editor"** in the left sidebar

3. Click **"New Query"**

4. Open file: `supabase/migration.sql`

5. Copy **ALL** the content (880+ lines)

6. Paste into the SQL Editor

7. Click **"Run"** (or press Ctrl+Enter)

8. Wait for: "Success. No rows returned"

9. Verify in **"Table Editor"** that these tables now exist:
   - profiles
   - projects
   - expenses ← Most important
   - incomes
   - work_categories
   - materials
   - workers
   - And more...

---

## 🎯 Quick Verification Checklist

Before asking for help, verify ALL these:

- [ ] `.env` file has `REACT_APP_SUPABASE_ANON_KEY=eyJ...` (starts with eyJ)
- [ ] Saved the `.env` file
- [ ] Restarted the app after changing `.env`
- [ ] Can see the login page at http://localhost:3000
- [ ] Tables exist in Supabase Table Editor
- [ ] Browser console (F12) is open to see errors
- [ ] Tried clearing browser cache

---

## 🆘 Still Need Help?

If you've completed ALL steps above and still have issues:

1. Open browser console (press F12)
2. Try the action that causes the error
3. Copy the EXACT error message (right-click → Copy)
4. Check Supabase logs:
   - Dashboard → Logs → API logs
5. Share both the browser error AND Supabase log

---

## 📝 Additional Fixes Applied

The following improvements have been made to prevent this issue:

1. ✅ Added validation in `supabase.js` to catch invalid keys early
2. ✅ Clear error messages when key format is wrong  
3. ✅ Updated `.env` with detailed instructions
4. ✅ Created this quick fix guide

---

## 🔐 Security Note

Never commit your actual API keys to git. The `.env` file should be in `.gitignore`.

If you accidentally committed your key:
1. Go to Supabase Dashboard → Settings → API
2. Click "Reset" next to the anon key
3. Copy the new key
4. Update your `.env` file
5. Restart the app

---

## ✨ Success Indicators

You'll know everything is working when:

1. ✅ App loads without console errors
2. ✅ Can log in/sign up successfully  
3. ✅ Can navigate to all pages
4. ✅ Can add expenses without errors
5. ✅ Data appears in Supabase Table Editor
6. ✅ No 400 errors in browser console

---

**Need the old instructions?** See `frontend/FIX_EXPENSES_ERROR.txt` for detailed troubleshooting.

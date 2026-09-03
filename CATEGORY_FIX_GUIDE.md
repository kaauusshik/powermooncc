# Fix Category Section - Complete Guide

## Issue
The category section in Settings is not displaying or allowing you to add new categories. Error: "Unable to add new category"

## Root Cause
The application cannot connect to the Supabase database because the environment variables are not configured.

## Solution

### Step 1: Set Up Supabase Connection

1. **Create the `.env` file:**
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. **Get your Supabase credentials:**
   - Go to https://supabase.com and sign in
   - Open your project (or create one if you haven't)
   - Go to **Settings → API**
   - Copy:
     - **Project URL** (looks like: `https://xxxxx.supabase.co`)
     - **anon/public key** (the long string under "Project API keys")

3. **Edit `frontend/.env` and add your credentials:**
   ```
   REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Step 2: Run Database Migration

The category tables (`work_categories` and `material_categories`) need to be created in your Supabase database.

1. **Go to Supabase SQL Editor:**
   - Open your Supabase project dashboard
   - Click on **SQL Editor** in the left sidebar

2. **Run the migration:**
   - Open the file `supabase/migration.sql` from your project
   - Copy the entire content
   - Paste it into the Supabase SQL Editor
   - Click **Run** or press Ctrl+Enter

   This creates all tables including:
   - `work_categories` (for work/job categories)
   - `material_categories` (for material categories)
   - Plus all other project tables, RLS policies, and seed data

### Step 3: Verify Database Setup

After running the migration, you should have:
- ✅ 8 default work categories (Brick Work, Road Work, Plumber Work, etc.)
- ✅ 10 material categories (Cement & Concrete, Aggregates, Masonry, etc.)

### Step 4: Start the Application

```bash
cd frontend
npm start
```

The app should open at `http://localhost:3000`

### Step 5: Sign Up and Access Settings

1. **Create your account:**
   - The first user automatically becomes the **Owner** (has all permissions)

2. **Go to Settings:**
   - Click on **Settings** in the navigation
   - Click the **Master Data** tab
   - You should now see:
     - **Work Categories** section with the default categories
     - **Material Categories** section with the default categories
     - **Clients** section (empty initially)

3. **Add a new category:**
   - Click the **+ Add** button next to any category section
   - Enter a category name
   - Click **Save**
   - The new category should appear immediately

## Troubleshooting

### Issue: "Unable to add new category"
**Possible causes:**
1. **.env file not configured** → Follow Step 1 above
2. **Database migration not run** → Follow Step 2 above
3. **User doesn't have permissions** → Make sure you're logged in as the Owner (first registered user)
4. **Invalid Supabase credentials** → Double-check your URL and anon key in `.env`

### Issue: Categories not showing
**Check:**
1. Open browser console (F12) and look for errors
2. Check Network tab for failed API calls
3. Verify `.env` file exists in `frontend/` directory (not in root)
4. Make sure to restart the dev server after creating/editing `.env`

### Issue: "Permission denied"
**Solution:**
- The first user to sign up becomes the Owner automatically
- If you already have users, log in with the Owner account
- Or go to Supabase → Authentication → Users and verify your user's role in the `profiles` table

### Issue: Database tables don't exist
**Solution:**
- Make sure you ran the **complete** `supabase/migration.sql` file
- Check Supabase → Table Editor to verify tables exist
- If tables are missing, run the migration again (it's safe to re-run)

## Database Schema Reference

### work_categories table
```sql
CREATE TABLE work_categories (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_default boolean DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### material_categories table
```sql
CREATE TABLE material_categories (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);
```

## Code Reference

The category management is handled by the `MasterList` component in `frontend/src/pages/Settings.jsx`:

- **Line 98-149**: `MasterList` component
- **Line 175-177**: Usage in Settings page:
  ```jsx
  <MasterList table="work_categories" label="Work Categories" />
  <MasterList table="material_categories" label="Material Categories" />
  <MasterList table="clients" label="Clients" />
  ```

The component:
1. Fetches data using `useRows(table, ...)` hook
2. Displays categories as rounded pills
3. Allows adding via `RecordForm` dialog
4. Allows deleting (for Owners only)

## Additional Notes

- **Work Categories**: Used for budgeting and tracking expenses by type of work
- **Material Categories**: Used for organizing materials in inventory
- **System Categories**: Some categories are system-level (shown but not editable):
  - Expense Categories: labor, material, transportation, food, travel, hotel, equipment, other
  - Worker Types: Helper, Mason, Carpenter, Electrician, Plumber, Painter, Supervisor
  - Payment Methods: cash, upi, bank_transfer, cheque

## Need More Help?

If the issue persists after following all steps:
1. Check the browser console for specific error messages
2. Check Supabase logs in your project dashboard
3. Verify your user has the "owner" role in the `profiles` table
4. Make sure Row Level Security (RLS) policies are properly set up by the migration

---
**POWER MOON CONSTRUCTION · by KUSIK**

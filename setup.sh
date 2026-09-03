#!/bin/bash

echo "=========================================="
echo "POWER MOON CONSTRUCTION - Setup Script"
echo "=========================================="
echo ""
echo "This script will help you set up Supabase connection"
echo ""

# Check if .env exists
if [ ! -f "frontend/.env" ]; then
    echo "❌ .env file not found in frontend/"
    echo ""
    echo "Creating .env template..."
    cp frontend/.env.example frontend/.env 2>/dev/null || true
fi

echo "📋 SETUP INSTRUCTIONS:"
echo ""
echo "STEP 1: Get your Supabase credentials"
echo "--------------------------------------"
echo "1. Go to https://supabase.com"
echo "2. Sign in or create a free account"
echo "3. Create a new project (or open existing one)"
echo "   - Project name: powermoon-construction"
echo "   - Database password: (choose a strong password)"
echo "   - Region: (choose closest to you)"
echo ""
echo "4. Wait for project to finish setting up (2-3 minutes)"
echo ""
echo "5. Go to Settings → API"
echo "6. Copy these values:"
echo "   - Project URL (looks like: https://xxxxx.supabase.co)"
echo "   - anon/public key (long string)"
echo ""
echo "STEP 2: Update .env file"
echo "------------------------"
echo "Edit: frontend/.env"
echo "Replace the placeholder values with your actual credentials"
echo ""
echo "STEP 3: Run database migration"
echo "-------------------------------"
echo "1. In Supabase dashboard, click 'SQL Editor' in the left menu"
echo "2. Click 'New Query'"
echo "3. Open the file: supabase/migration.sql"
echo "4. Copy the ENTIRE content"
echo "5. Paste into Supabase SQL Editor"
echo "6. Click 'Run' (or press Ctrl+Enter)"
echo "7. Wait for 'Success' message"
echo ""
echo "STEP 4: Start the application"
echo "------------------------------"
echo "cd frontend"
echo "npm start"
echo ""
echo "STEP 5: Test categories"
echo "-----------------------"
echo "1. Sign up (first user becomes Owner)"
echo "2. Go to Settings → Master Data"
echo "3. Try adding a category"
echo ""
echo "=========================================="
echo ""

# Check if dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Dependencies not installed"
    echo "Run: cd frontend && npm install"
    echo ""
fi

# Show current .env status
if [ -f "frontend/.env" ]; then
    echo "✅ .env file exists"
    if grep -q "your-project-id" frontend/.env; then
        echo "⚠️  .env still contains placeholder values"
        echo "   Please update with your actual Supabase credentials"
    else
        echo "✅ .env appears to be configured"
    fi
else
    echo "❌ .env file missing"
fi

echo ""
echo "Need help? Check CATEGORY_FIX_GUIDE.md"
echo "=========================================="

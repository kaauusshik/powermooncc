-- =====================================================================
-- Add "payment" to expense categories constraint
-- Run this in Supabase SQL Editor to allow "payment" as an expense category
-- =====================================================================

-- Drop the old constraint
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- Add new constraint with "payment" included
ALTER TABLE public.expenses
ADD CONSTRAINT expenses_category_check
CHECK (category IN (
  'labor',
  'material',
  'contractor',
  'transportation',
  'payment',
  'food',
  'travel',
  'hotel',
  'equipment',
  'other'
));

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Payment category added successfully! You can now use "payment" as an expense category.';
END $$;

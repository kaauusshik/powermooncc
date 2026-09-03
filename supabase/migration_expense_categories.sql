-- =====================================================================
-- OPTIONAL: Custom Expense Categories Table
-- Run this ONLY if you want to manage expense categories in the database
-- instead of using the hardcoded system categories.
-- =====================================================================

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same as work_categories)
DROP POLICY IF EXISTS p_expense_categories_select ON public.expense_categories;
CREATE POLICY p_expense_categories_select ON public.expense_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS p_expense_categories_insert ON public.expense_categories;
CREATE POLICY p_expense_categories_insert ON public.expense_categories
  FOR INSERT TO authenticated WITH CHECK (public.my_role() IS NOT NULL);

DROP POLICY IF EXISTS p_expense_categories_update ON public.expense_categories;
CREATE POLICY p_expense_categories_update ON public.expense_categories
  FOR UPDATE TO authenticated USING (public.my_role() IN ('owner','manager','accountant'));

DROP POLICY IF EXISTS p_expense_categories_delete ON public.expense_categories;
CREATE POLICY p_expense_categories_delete ON public.expense_categories
  FOR DELETE TO authenticated USING (public.is_owner());

-- Seed with default expense categories
INSERT INTO public.expense_categories (name, is_default) VALUES
  ('labor', true),
  ('material', true),
  ('contractor', true),
  ('transportation', true),
  ('food', true),
  ('travel', true),
  ('hotel', true),
  ('equipment', true),
  ('other', true)
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;

-- =====================================================================
-- IMPORTANT: After running this migration, update Expenses.jsx
-- =====================================================================
-- Change line 9 in frontend/src/pages/Expenses.jsx from:
--   { name: "category", label: "Category", type: "select", options: EXPENSE_CATEGORIES, required: true },
-- To:
--   { name: "category", label: "Category", lookup: { table: "expense_categories", byLabel: true, creatable: true }, newPlaceholder: "New expense category", placeholder: "Select or create category…", required: true },
-- =====================================================================

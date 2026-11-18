-- ==============================================================================
-- Migration: 20261118_add_country_column.sql
-- Description: Adds a dedicated country column to public.students and backfills
--              from raw_data->>'country' so child nationality/country is stored
--              explicitly instead of overloading the dialect column.
-- ==============================================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS country TEXT;

UPDATE public.students
SET country = COALESCE(
  NULLIF(raw_data->>'country', ''),
  CASE
    WHEN dialect IS NOT NULL AND lower(dialect) NOT IN ('faseeh', 'msa', 'other', 'egyptian', 'saudi', 'gulf', 'levantine', 'maghrebi')
      THEN dialect
    ELSE NULL
  END
)
WHERE country IS NULL;

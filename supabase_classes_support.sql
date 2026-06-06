-- Add classes column to churches table to support custom classes lists (as a JSON array)
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS classes JSONB DEFAULT NULL;

-- Notify schema reload immediately
NOTIFY pgrst, 'reload schema';

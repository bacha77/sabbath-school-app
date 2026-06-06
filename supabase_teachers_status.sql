-- Add is_active column to teachers table
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update any existing teachers to be active
UPDATE public.teachers SET is_active = TRUE WHERE is_active IS NULL;

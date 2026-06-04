-- Phase 1: Add email column to churches
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS email TEXT;

-- Set a placeholder email for the original Philadelphie church
UPDATE public.churches 
SET email = 'admin@philadelphie.test' 
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Phase 3: Create teachers table for class-level access
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    assigned_class TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Optional, depending on security needs, but we'll leave it simple for now)

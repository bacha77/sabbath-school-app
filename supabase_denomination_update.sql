-- Add denomination column to churches
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS denomination TEXT DEFAULT 'Adventist';

-- Ensure Philadelphie is explicitly set to Adventist
UPDATE public.churches 
SET denomination = 'Adventist' 
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Add logo_url to the churches table
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Set the default logo for Philadelphie Sabbath School
UPDATE public.churches 
SET logo_url = '/logo.png' 
WHERE id = '11111111-1111-1111-1111-111111111111';

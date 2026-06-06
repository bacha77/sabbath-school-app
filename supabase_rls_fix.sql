-- Fix for Row-Level Security (RLS) blocking Teacher insertions
-- Run this in the Supabase SQL Editor

ALTER TABLE public.teachers DISABLE ROW LEVEL SECURITY;

-- If you prefer to keep RLS enabled, run these lines instead to allow public access:
-- ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read access to teachers" ON public.teachers FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert to teachers" ON public.teachers FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public delete to teachers" ON public.teachers FOR DELETE USING (true);

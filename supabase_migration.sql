-- 1. Create the Churches Table
CREATE TABLE IF NOT EXISTS public.churches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all required columns exist (in case the table was created earlier without them)
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS admin_pin TEXT;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS address TEXT;

-- For existing rows that might have a null admin_pin, set a default before making it required
UPDATE public.churches SET admin_pin = '43224' WHERE admin_pin IS NULL;

-- 2. Insert Philadelphie as the default first church
INSERT INTO public.churches (id, name, address, admin_pin)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Philadelphie Sabbath School', 
    '2169 FERRIS RD COLUMBUS OH 43224', 
    '43224'
) ON CONFLICT (id) DO 
UPDATE SET admin_pin = EXCLUDED.admin_pin, name = EXCLUDED.name;

-- 3. Add church_id to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id);

UPDATE public.students SET church_id = '11111111-1111-1111-1111-111111111111' WHERE church_id IS NULL;

-- 4. Add church_id to attendance_logs table
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id);

UPDATE public.attendance_logs SET church_id = '11111111-1111-1111-1111-111111111111' WHERE church_id IS NULL;

-- 5. Add church_id to collections table
ALTER TABLE public.collections 
ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id);

UPDATE public.collections SET church_id = '11111111-1111-1111-1111-111111111111' WHERE church_id IS NULL;

-- 6. Update Constraints
-- We need to drop the old unique constraints and replace them to include church_id
-- For collections:
ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_class_name_date_key;
ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_church_class_date_key;
ALTER TABLE public.collections ADD CONSTRAINT collections_church_class_date_key UNIQUE (church_id, class_name, date);

-- For attendance_logs:
ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_student_id_date_key;
ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_church_student_date_key;
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_church_student_date_key UNIQUE (church_id, student_id, date);

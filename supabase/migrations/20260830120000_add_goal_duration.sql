ALTER TABLE goals ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS duration text;
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_duration_check;
ALTER TABLE goals ADD CONSTRAINT goals_duration_check CHECK (duration IS NULL OR duration IN ('1w','2w','3w','1m','2m'));
UPDATE goals SET start_date = COALESCE(start_date, created_at::date) WHERE start_date IS NULL;
UPDATE goals SET duration = COALESCE(duration, CASE WHEN deadline IS NULL THEN NULL WHEN deadline - created_at::date <= 7 THEN '1w' WHEN deadline - created_at::date <= 14 THEN '2w' WHEN deadline - created_at::date <= 21 THEN '3w' WHEN deadline - created_at::date <= 45 THEN '1m' ELSE '2m' END) WHERE duration IS NULL;

ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_duration_check;
ALTER TABLE goals ADD CONSTRAINT goals_duration_check CHECK (duration IS NULL OR duration IN ('1w','2w','3w','1m','2m','4w','8w','12w','26w'));

-- The legacy website waitlist is empty, has no database dependants or policies,
-- and is not referenced by the VOW repository. Keep public.vow_waitlist separate.
DROP TABLE IF EXISTS website.waitlist;

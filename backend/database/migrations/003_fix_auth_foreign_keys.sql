-- ============================================================
-- TELEGRAM DRIVE
-- FIX AUTH USER FOREIGN KEYS
-- ============================================================

BEGIN;


-- ============================================================
-- FOLDERS
-- ============================================================

ALTER TABLE folders
DROP CONSTRAINT IF EXISTS folders_user_id_fkey;

ALTER TABLE folders
ADD CONSTRAINT folders_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;


-- ============================================================
-- FILES
-- ============================================================

ALTER TABLE files
DROP CONSTRAINT IF EXISTS files_user_id_fkey;

ALTER TABLE files
ADD CONSTRAINT files_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;


-- ============================================================
-- TELEGRAM ACCOUNTS
-- ============================================================

ALTER TABLE telegram_accounts
DROP CONSTRAINT IF EXISTS telegram_accounts_user_id_fkey;

ALTER TABLE telegram_accounts
ADD CONSTRAINT telegram_accounts_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;


COMMIT;
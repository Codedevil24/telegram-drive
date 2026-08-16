-- ============================================================
-- TELEGRAM DRIVE
-- DATABASE UPDATE 002
-- ============================================================


-- ============================================================
-- REQUIRED EXTENSION
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- TELEGRAM ACCOUNTS
-- ============================================================

ALTER TABLE telegram_accounts
ADD COLUMN IF NOT EXISTS updated_at
TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ============================================================
-- FOLDERS
-- ============================================================

ALTER TABLE folders
ADD COLUMN IF NOT EXISTS parent_id UUID;


-- ============================================================
-- FILES
-- ============================================================

ALTER TABLE files
ADD COLUMN IF NOT EXISTS thumbnail_file_id TEXT;

ALTER TABLE files
ADD COLUMN IF NOT EXISTS duration INTEGER;

ALTER TABLE files
ADD COLUMN IF NOT EXISTS updated_at
TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ============================================================
-- FOLDER INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
idx_folders_user_parent_name
ON folders(
    user_id,
    parent_id,
    name
);


-- ============================================================
-- FILE SEARCH INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS
idx_files_name
ON files(name);


-- ============================================================
-- UPDATED_AT FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION
update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.updated_at = NOW();

    RETURN NEW;

END;
$$;


-- ============================================================
-- TELEGRAM ACCOUNT UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS
telegram_accounts_updated_at
ON telegram_accounts;


CREATE TRIGGER
telegram_accounts_updated_at

BEFORE UPDATE
ON telegram_accounts

FOR EACH ROW

EXECUTE FUNCTION
update_updated_at_column();


-- ============================================================
-- FILE UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS
files_updated_at
ON files;


CREATE TRIGGER
files_updated_at

BEFORE UPDATE
ON files

FOR EACH ROW

EXECUTE FUNCTION
update_updated_at_column();


-- ============================================================
-- FOLDER UPDATED_AT
-- ============================================================

ALTER TABLE folders
ADD COLUMN IF NOT EXISTS updated_at
TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ============================================================
-- FOLDER UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS
folders_updated_at
ON folders;


CREATE TRIGGER
folders_updated_at

BEFORE UPDATE
ON folders

FOR EACH ROW

EXECUTE FUNCTION
update_updated_at_column();
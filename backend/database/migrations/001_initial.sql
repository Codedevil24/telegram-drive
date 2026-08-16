-- ============================================
-- TELEGRAM DRIVE
-- INITIAL DATABASE SCHEMA
-- ============================================


-- ============================================
-- TELEGRAM ACCOUNTS
-- ============================================

CREATE TABLE IF NOT EXISTS telegram_accounts (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    telegram_user_id BIGINT NOT NULL,

    username TEXT,

    phone TEXT,

    session_encrypted TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id),

    UNIQUE(telegram_user_id)

);


-- ============================================
-- FOLDERS
-- ============================================

CREATE TABLE IF NOT EXISTS folders (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    parent_id UUID
        REFERENCES folders(id)
        ON DELETE CASCADE,

    name TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);


-- ============================================
-- FILES
-- ============================================

CREATE TABLE IF NOT EXISTS files (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    folder_id UUID
        REFERENCES folders(id)
        ON DELETE SET NULL,

    telegram_account_id UUID
        REFERENCES telegram_accounts(id)
        ON DELETE SET NULL,

    telegram_chat_id BIGINT,

    telegram_message_id BIGINT,

    telegram_file_id TEXT,

    name TEXT NOT NULL,

    size BIGINT NOT NULL DEFAULT 0,

    mime_type TEXT,

    thumbnail_file_id TEXT,

    duration INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_telegram_accounts_user_id
ON telegram_accounts(user_id);


CREATE INDEX IF NOT EXISTS idx_folders_user_id
ON folders(user_id);


CREATE INDEX IF NOT EXISTS idx_folders_parent_id
ON folders(parent_id);


CREATE INDEX IF NOT EXISTS idx_files_user_id
ON files(user_id);


CREATE INDEX IF NOT EXISTS idx_files_folder_id
ON files(folder_id);


CREATE INDEX IF NOT EXISTS idx_files_telegram_message
ON files(
    telegram_account_id,
    telegram_chat_id,
    telegram_message_id
);
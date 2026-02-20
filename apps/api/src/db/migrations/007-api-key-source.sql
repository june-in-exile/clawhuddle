ALTER TABLE api_keys ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE api_keys ADD COLUMN refresh_token TEXT;
ALTER TABLE api_keys ADD COLUMN token_expires_at INTEGER;

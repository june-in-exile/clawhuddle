-- Member channel tokens (e.g. Telegram bot token, Discord bot token)
CREATE TABLE IF NOT EXISTS member_channels (
    member_id TEXT NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    bot_token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id, channel)
);

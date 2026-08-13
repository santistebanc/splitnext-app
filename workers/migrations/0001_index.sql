CREATE TABLE access_tokens (
  token_hash TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  device_user_id TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX access_tokens_group_device
  ON access_tokens (group_id, device_user_id);

CREATE TABLE invites (
  token_hash TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT
);

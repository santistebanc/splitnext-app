CREATE TABLE device_push_tokens (
  group_id TEXT NOT NULL,
  device_user_id TEXT NOT NULL,
  expo_push_token TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (group_id, device_user_id)
);

CREATE INDEX device_push_tokens_group ON device_push_tokens (group_id);

ALTER TABLE users
ADD COLUMN can_access_web BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN can_access_mobile BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX users_can_access_web_idx
ON users(can_access_web);

CREATE INDEX users_can_access_mobile_idx
ON users(can_access_mobile);

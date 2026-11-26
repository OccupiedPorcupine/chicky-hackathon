-- When the user saw the first-sign-in welcome (issue #25); null until then. It is shown once per
-- account, before the Dashboard. Accounts that already exist have signed in before, so they skip it.
ALTER TABLE app_users ADD COLUMN welcome_seen_at TIMESTAMP WITH TIME ZONE;
UPDATE app_users SET welcome_seen_at = CURRENT_TIMESTAMP;

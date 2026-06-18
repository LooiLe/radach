ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests VARCHAR(255);

-- Mark existing users as having completed onboarding so they don't see the wizard
UPDATE users SET onboarding_completed = true WHERE onboarding_completed = false;
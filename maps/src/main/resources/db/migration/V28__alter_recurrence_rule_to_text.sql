-- V27: Alter recurrence_rule to TEXT to avoid length limits when storing many exceptions
ALTER TABLE events ALTER COLUMN recurrence_rule TYPE TEXT;
ALTER TABLE calendar_entries ALTER COLUMN recurrence_rule TYPE TEXT;

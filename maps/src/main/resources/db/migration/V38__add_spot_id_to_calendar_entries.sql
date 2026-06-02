ALTER TABLE calendar_entries
    ADD COLUMN spot_id BIGINT REFERENCES spots(id) ON DELETE SET NULL;

CREATE INDEX idx_calendar_entries_spot ON calendar_entries(spot_id);

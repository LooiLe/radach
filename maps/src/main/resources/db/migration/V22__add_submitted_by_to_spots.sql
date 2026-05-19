ALTER TABLE spots ADD COLUMN submitted_by BIGINT REFERENCES users(id);

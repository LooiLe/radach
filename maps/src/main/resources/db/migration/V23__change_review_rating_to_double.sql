-- Change the rating column from INT to DOUBLE PRECISION to support decimal ratings like 2.4, 4.8, etc.
ALTER TABLE reviews ALTER COLUMN rating TYPE DOUBLE PRECISION;

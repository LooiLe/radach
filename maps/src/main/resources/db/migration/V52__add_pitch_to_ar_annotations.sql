-- Add pitch column to support height-aware positioning of AR annotations
ALTER TABLE ar_annotations ADD COLUMN pitch DOUBLE PRECISION;

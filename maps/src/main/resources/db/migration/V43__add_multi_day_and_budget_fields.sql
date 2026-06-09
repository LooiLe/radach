-- Add multi-day itinerary support and budget tracking fields

-- Add day_number to itinerary_stops (default 1 for backward compat with existing single-day itineraries)
ALTER TABLE itinerary_stops ADD COLUMN day_number INTEGER NOT NULL DEFAULT 1;

-- Add estimated_cost_cents to itinerary_stops (nullable — users can optionally track budget)
ALTER TABLE itinerary_stops ADD COLUMN estimated_cost_cents INTEGER;

-- Add end_date to itineraries (nullable — single-day itineraries only have date)
ALTER TABLE itineraries ADD COLUMN end_date DATE;

-- Add currency to itineraries (default USD)
ALTER TABLE itineraries ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';

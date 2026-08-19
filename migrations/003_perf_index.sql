-- Performance index: speeds up queries that filter by event_type + timestamp range
-- (tokens route, insights rules, 7-day sparkline inner subqueries)
CREATE INDEX IF NOT EXISTS idx_events_type_time ON cc_events(event_type, timestamp);

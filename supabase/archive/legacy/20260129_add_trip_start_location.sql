-- Migration: Add start_location column to camping_trips table for custom trip origin with address text.

ALTER TABLE camping_trips 
ADD COLUMN IF NOT EXISTS start_location text;

comment on column camping_trips.start_location is 'Custom starting location address for this specific trip. Falls back to profile default if null.';

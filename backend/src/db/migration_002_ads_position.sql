-- Migration 002: Remove position CHECK constraint from ad_placements
-- Allows flexible position names (cpbl_header, npb_header, sidebar, etc.)
-- Run: docker exec -i cloudecode-db-1 psql -U postgres -d sportsdb < migration_002_ads_position.sql

ALTER TABLE ad_placements DROP CONSTRAINT IF EXISTS ad_placements_position_check;

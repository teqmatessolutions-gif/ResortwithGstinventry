-- Clear all assigned services and services from the database
-- Run this script using: psql -U postgres -d orchiddb -f clear_services.sql

-- Delete in correct order to avoid foreign key violations

-- 1. Delete assigned services first (they reference services)
DELETE FROM assigned_services;

-- 2. Delete service inventory item links (they reference services)
DELETE FROM service_inventory_items;

-- 3. Delete service images (they reference services)
DELETE FROM service_images;

-- 4. Finally delete services
DELETE FROM services;

-- Show confirmation
SELECT 'All services and assigned services have been deleted.' AS status;


-- DELETE ALL SERVICES AND ASSIGNED SERVICES
-- Run this script in your PostgreSQL client (pgAdmin, DBeaver, psql, etc.)

-- Delete in correct order to avoid foreign key violations

-- 1. Delete all assigned services
DELETE FROM assigned_services;

-- 2. Delete all service inventory item links
DELETE FROM service_inventory_items;

-- 3. Delete all service images
DELETE FROM service_images;

-- 4. Delete all services
DELETE FROM services;

-- Verify deletion
SELECT 
    (SELECT COUNT(*) FROM assigned_services) as assigned_services_count,
    (SELECT COUNT(*) FROM service_inventory_items) as inventory_items_count,
    (SELECT COUNT(*) FROM service_images) as images_count,
    (SELECT COUNT(*) FROM services) as services_count;

-- All counts should be 0


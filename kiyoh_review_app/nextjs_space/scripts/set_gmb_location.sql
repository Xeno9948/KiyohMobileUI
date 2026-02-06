-- Quick fix: Set GMB Location ID manually
-- Run this in Railway's PostgreSQL query tab

UPDATE "Company"
SET 
  "gmbLocationId" = 'locations/11535144745965350294',
  "gmbEnabled" = true
WHERE "gmbAccessToken" IS NOT NULL;

-- Verify it worked
SELECT 
  id,
  name,
  "gmbEnabled",
  "gmbLocationId",
  "gmbAccountId"
FROM "Company"
WHERE "gmbAccessToken" IS NOT NULL;

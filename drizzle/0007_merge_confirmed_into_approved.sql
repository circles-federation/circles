-- a meeting reaching its vote threshold used to be its own kind ("confirmed");
-- it's now "approved", like a circle-hosted event that was approved. An event is
-- either a meeting or circle-hosted, so a member never has both for one event.
UPDATE "event_notifications" SET "kind" = 'approved' WHERE "kind" = 'confirmed';

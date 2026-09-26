-- "council" is no longer a circle type: every council becomes a plain "circle".
-- Renaming the enum value converts every row using it at once, circles and
-- circle_members' denormalized copy alike, with no rewrite and no FK juggling.
ALTER TYPE "public"."circle_type" RENAME VALUE 'council' TO 'circle';

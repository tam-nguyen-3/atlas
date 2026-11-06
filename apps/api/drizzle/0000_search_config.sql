-- Accent-insensitive search. A generated column can't call unaccent()
-- because it isn't immutable, but it can use this configuration through the
-- immutable two-argument to_tsvector.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
--> statement-breakpoint
CREATE TEXT SEARCH CONFIGURATION public.atlas_search (COPY = pg_catalog.simple);
--> statement-breakpoint
ALTER TEXT SEARCH CONFIGURATION public.atlas_search
  ALTER MAPPING FOR hword, hword_part, word WITH public.unaccent, pg_catalog.simple;

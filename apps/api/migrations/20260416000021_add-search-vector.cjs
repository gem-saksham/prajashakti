'use strict';

/**
 * Day 26 — Add PostgreSQL full-text search vector to issues table.
 * Weights: title=A, description=B, district=C, state=D
 * Trigger keeps it in sync on insert/update.
 * GIN index makes @@ queries fast.
 */
exports.up = async (pgm) => {
  // 1. Add the tsvector column
  pgm.addColumn('issues', {
    search_vector: { type: 'tsvector' },
  });

  // 2. Backfill all existing rows
  pgm.sql(`
    UPDATE issues SET search_vector =
      setweight(to_tsvector('english', coalesce(title,       '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(district,    '')), 'C') ||
      setweight(to_tsvector('english', coalesce(state,       '')), 'D')
  `);

  // 3. Trigger function — auto-updates on write
  pgm.sql(`
    CREATE OR REPLACE FUNCTION issues_search_trigger() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.title,       '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.district,    '')), 'C') ||
        setweight(to_tsvector('english', coalesce(NEW.state,       '')), 'D');
      RETURN NEW;
    END $$ LANGUAGE plpgsql
  `);

  // 4. Attach trigger
  pgm.sql(`
    CREATE TRIGGER issues_search_update
    BEFORE INSERT OR UPDATE OF title, description, district, state
    ON issues FOR EACH ROW EXECUTE FUNCTION issues_search_trigger()
  `);

  // 5. GIN index (cannot use CONCURRENTLY inside a transaction block)
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_issues_search_vector
    ON issues USING gin(search_vector)
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP TRIGGER IF EXISTS issues_search_update ON issues');
  pgm.sql('DROP FUNCTION IF EXISTS issues_search_trigger()');
  pgm.sql('DROP INDEX IF EXISTS idx_issues_search_vector');
  pgm.dropColumn('issues', 'search_vector');
};

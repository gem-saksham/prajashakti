/**
 * Migration: Enable PostGIS and add geography columns to issues + users.
 *
 * Requires postgis/postgis:16-x Docker image (or PostGIS installed on the server).
 * The geography column is kept in sync with location_lat/lng via a trigger so
 * callers never have to manage it explicitly.
 *
 * Geo queries switch from the Haversine approximation to PostGIS ST_DWithin /
 * ST_Distance which use a proper spheroid for Indian coordinates.
 */

exports.up = async function up(pgm) {
  // ── 0. Enable extension ───────────────────────────────────────────────────
  await pgm.db.query('CREATE EXTENSION IF NOT EXISTS postgis');

  // ── 1. issues table ───────────────────────────────────────────────────────
  await pgm.db.query(`
    ALTER TABLE issues
      ADD COLUMN IF NOT EXISTS location_geog GEOGRAPHY(POINT, 4326);
  `);

  // Backfill existing rows
  await pgm.db.query(`
    UPDATE issues
    SET location_geog = ST_SetSRID(
      ST_MakePoint(location_lng::float8, location_lat::float8), 4326
    )::geography
    WHERE location_lat IS NOT NULL
      AND location_lng IS NOT NULL
      AND location_geog IS NULL;
  `);

  // Trigger: keep location_geog in sync with lat/lng on every INSERT or UPDATE
  await pgm.db.query(`
    CREATE OR REPLACE FUNCTION sync_issues_geog()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
        NEW.location_geog := ST_SetSRID(
          ST_MakePoint(NEW.location_lng::float8, NEW.location_lat::float8), 4326
        )::geography;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await pgm.db.query(`
    DROP TRIGGER IF EXISTS issues_sync_geog ON issues;
    CREATE TRIGGER issues_sync_geog
      BEFORE INSERT OR UPDATE OF location_lat, location_lng
      ON issues
      FOR EACH ROW EXECUTE FUNCTION sync_issues_geog();
  `);

  // Spatial index (GiST)
  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_issues_geog
      ON issues USING GIST(location_geog);
  `);

  // ── 2. users table (for "issues near me" / heat-map) ─────────────────────
  await pgm.db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS location_geog GEOGRAPHY(POINT, 4326);
  `);

  await pgm.db.query(`
    CREATE OR REPLACE FUNCTION sync_users_geog()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Users store their approximate home district, not precise GPS.
      -- We only populate if explicit coords are later added to the users table.
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_users_geog
      ON users USING GIST(location_geog)
      WHERE location_geog IS NOT NULL;
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query('DROP TRIGGER IF EXISTS issues_sync_geog ON issues');
  await pgm.db.query('DROP TRIGGER IF EXISTS users_sync_geog ON users');
  await pgm.db.query('DROP FUNCTION IF EXISTS sync_issues_geog()');
  await pgm.db.query('DROP FUNCTION IF EXISTS sync_users_geog()');
  await pgm.db.query('DROP INDEX IF EXISTS idx_issues_geog');
  await pgm.db.query('DROP INDEX IF EXISTS idx_users_geog');
  await pgm.db.query('ALTER TABLE issues DROP COLUMN IF EXISTS location_geog');
  await pgm.db.query('ALTER TABLE users DROP COLUMN IF EXISTS location_geog');
};

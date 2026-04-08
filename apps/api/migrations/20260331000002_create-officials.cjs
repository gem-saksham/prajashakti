/**
 * Migration: create officials table
 * Stores government bureaucrats and politicians with accountability metrics.
 * Optionally linked to a user account if the official claims their profile.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE officials (
      id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      name             VARCHAR(200)  NOT NULL,
      designation      VARCHAR(200)  NOT NULL,
      department       VARCHAR(200),
      district         VARCHAR(100),
      state            VARCHAR(100),
      phone            VARCHAR(10),
      email            VARCHAR(255),
      office_address   TEXT,
      user_id          UUID          REFERENCES users(id),
      rating           DECIMAL(2,1)  DEFAULT 0.0,
      total_ratings    INTEGER       DEFAULT 0,
      pending_issues   INTEGER       DEFAULT 0,
      resolved_issues  INTEGER       DEFAULT 0,
      response_rate    DECIMAL(5,2)  DEFAULT 0.0,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_officials_district_state ON officials(district, state);
    CREATE INDEX idx_officials_rating         ON officials(rating DESC);

    CREATE TRIGGER officials_updated_at
      BEFORE UPDATE ON officials
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS officials CASCADE;`);
}

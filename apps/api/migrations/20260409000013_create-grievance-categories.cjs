/**
 * Migration: create grievance_categories table
 * Maps PrajaShakti's user-facing categories to specific government
 * department categories. Phase 2 Sprint 9 NLP routing will classify into these.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE grievance_categories (
      id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name                  VARCHAR(200) NOT NULL,
      slug                  VARCHAR(100) UNIQUE NOT NULL,
      parent_category_id    UUID         REFERENCES grievance_categories(id),
      default_department_id UUID         REFERENCES departments(id),
      praja_category        VARCHAR(50)  NOT NULL CHECK (praja_category IN (
                              'Infrastructure', 'Healthcare', 'Education', 'Safety',
                              'Environment', 'Agriculture', 'Corruption', 'Other'
                            )),
      cpgrams_category_code VARCHAR(50),
      keywords              TEXT[],
      description           TEXT,
      is_active             BOOLEAN      NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_grievance_cat_parent     ON grievance_categories(parent_category_id);
    CREATE INDEX idx_grievance_cat_department ON grievance_categories(default_department_id);
    CREATE INDEX idx_grievance_cat_praja      ON grievance_categories(praja_category);
    CREATE INDEX idx_grievance_cat_keywords   ON grievance_categories USING gin(keywords);
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS grievance_categories CASCADE;`);
}

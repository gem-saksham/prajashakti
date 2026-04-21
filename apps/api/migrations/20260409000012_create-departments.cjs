/**
 * Migration: create departments table
 * Departments sit under ministries. This is the granularity
 * CPGRAMS routes grievances to. Supports self-referencing hierarchy.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE departments (
      id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      ministry_id           UUID         NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
      code                  VARCHAR(50)  NOT NULL,
      name                  VARCHAR(300) NOT NULL,
      nodal_officer_title   VARCHAR(200),
      public_email          VARCHAR(255),
      public_phone          VARCHAR(20),
      jurisdiction_type     VARCHAR(30)  CHECK (jurisdiction_type IN (
                              'national', 'state', 'district', 'municipal', 'local'
                            )),
      jurisdiction_code     VARCHAR(50),
      parent_department_id  UUID         REFERENCES departments(id),
      cpgrams_code          VARCHAR(50),
      resolution_sla_days   INTEGER      DEFAULT 21,
      is_active             BOOLEAN      NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      UNIQUE(ministry_id, code)
    );

    CREATE INDEX idx_departments_ministry     ON departments(ministry_id);
    CREATE INDEX idx_departments_jurisdiction ON departments(jurisdiction_type, jurisdiction_code);
    CREATE INDEX idx_departments_parent       ON departments(parent_department_id);
    CREATE INDEX idx_departments_cpgrams      ON departments(cpgrams_code);

    CREATE TRIGGER departments_updated_at
      BEFORE UPDATE ON departments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS departments CASCADE;`);
}

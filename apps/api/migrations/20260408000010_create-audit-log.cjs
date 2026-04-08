/* eslint-disable */
/**
 * Migration: create audit_log table for security-relevant event tracking.
 */

exports.up = async (pgm) => {
  pgm.createTable('audit_log', {
    id: {
      type:       'uuid',
      primaryKey: true,
      default:    pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type:       'uuid',
      references: '"users"(id)',
      onDelete:   'SET NULL',
      notNull:    false,
    },
    event_type: {
      type:    'varchar(50)',
      notNull: true,
    },
    ip_address: {
      type:    'inet',
      notNull: false,
    },
    user_agent: {
      type:    'text',
      notNull: false,
    },
    metadata: {
      type:    'jsonb',
      default: pgm.func("'{}'::jsonb"),
    },
    severity: {
      type:    'varchar(20)',
      default: pgm.func("'info'"),
      notNull: true,
    },
    created_at: {
      type:     'timestamptz',
      notNull:  true,
      default:  pgm.func('NOW()'),
    },
  });

  // Fast lookups: user timeline, event type queries, severity alerts
  pgm.createIndex('audit_log', ['user_id',    'created_at'], { name: 'idx_audit_user',     order: { created_at: 'DESC' } });
  pgm.createIndex('audit_log', ['event_type', 'created_at'], { name: 'idx_audit_event',    order: { created_at: 'DESC' } });
  pgm.createIndex('audit_log', ['severity',   'created_at'], { name: 'idx_audit_severity', order: { created_at: 'DESC' } });
};

exports.down = async (pgm) => {
  pgm.dropTable('audit_log');
};

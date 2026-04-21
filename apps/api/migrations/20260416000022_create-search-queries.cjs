'use strict';

/**
 * Day 26 — Search analytics table.
 * Tracks every search query for:
 *   - Popular query suggestions (autocomplete)
 *   - Phase 2 NLP training data
 *   - Click-through rate measurement
 *   - Zero-result query detection
 */
exports.up = async (pgm) => {
  pgm.createTable('search_queries', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
    query: { type: 'text', notNull: true },
    filters: {
      type: 'jsonb',
      default: pgm.func("'{}'::jsonb"),
    },
    result_count: { type: 'integer' },
    clicked_issue_id: {
      type: 'uuid',
      references: '"issues"',
      onDelete: 'SET NULL',
    },
    session_id: { type: 'varchar(64)' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('search_queries', 'created_at', {
    name: 'idx_search_queries_created',
    order: 'DESC',
  });

  // FTS index on query text — for "did you mean?" and analytics
  pgm.sql(`
    CREATE INDEX idx_search_queries_text
    ON search_queries USING gin(to_tsvector('english', query))
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('search_queries');
};

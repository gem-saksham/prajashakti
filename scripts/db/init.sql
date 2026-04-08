-- PostgreSQL initialisation script
-- Runs once when the container is first created (docker-entrypoint-initdb.d).

-- pgcrypto provides gen_random_uuid() on PG < 13; on PG 13+ it is built-in.
-- Including it here ensures compatibility and makes the intent explicit.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- uuid-ossp provides uuid_generate_v4() as an alias — useful for tooling that
-- expects this function name (e.g., some ORMs).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

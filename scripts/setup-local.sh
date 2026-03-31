#!/usr/bin/env bash
# setup-local.sh — initialise local dev services (run after docker compose up)
set -euo pipefail

POSTGRES_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/prajashakti}"
LOCALSTACK_ENDPOINT="${AWS_S3_ENDPOINT:-http://localhost:4566}"
S3_BUCKET="${AWS_S3_BUCKET:-prajashakti-media}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[setup]${NC} $*"; }
error() { echo -e "${RED}[setup]${NC} $*" >&2; exit 1; }

# ─── Wait for Postgres ────────────────────────────────────────────────────────
wait_for_postgres() {
  info "Waiting for PostgreSQL..."
  local retries=20
  until psql "$POSTGRES_URL" -c '\q' 2>/dev/null; do
    retries=$((retries - 1))
    [ "$retries" -eq 0 ] && error "PostgreSQL did not become ready in time."
    sleep 2
  done
  info "PostgreSQL is ready."
}

# ─── Schema bootstrap ─────────────────────────────────────────────────────────
init_schema() {
  info "Initialising database schema..."
  psql "$POSTGRES_URL" <<'SQL'
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       VARCHAR(15) UNIQUE NOT NULL,
  name        VARCHAR(120),
  state       VARCHAR(60),
  district    VARCHAR(60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Officials / bureaucrats
CREATE TABLE IF NOT EXISTS officials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  designation   VARCHAR(120),
  department    VARCHAR(120),
  jurisdiction  VARCHAR(120),
  email         VARCHAR(254),
  phone         VARCHAR(15),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Issues filed by citizens
CREATE TABLE IF NOT EXISTS issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  category        VARCHAR(60),
  location        VARCHAR(120),
  state           VARCHAR(60),
  district        VARCHAR(60),
  urgency         VARCHAR(20) DEFAULT 'medium',
  status          VARCHAR(20) DEFAULT 'open',
  supporter_count INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  official_id     UUID REFERENCES officials(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Citizen support (one per user per issue)
CREATE TABLE IF NOT EXISTS issue_supports (
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (issue_id, user_id)
);

-- Escalation log
CREATE TABLE IF NOT EXISTS escalations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  level       VARCHAR(60) NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_at TIMESTAMPTZ,
  notes       TEXT
);

-- Media / video evidence
CREATE TABLE IF NOT EXISTS media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  s3_key      VARCHAR(500) NOT NULL,
  mime_type   VARCHAR(80),
  size_bytes  BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Donations (micro)
CREATE TABLE IF NOT EXISTS donations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  amount_paise INT NOT NULL,
  status      VARCHAR(20) DEFAULT 'pending',
  razorpay_id VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_issues_status     ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category   ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_district   ON issues(district);
CREATE INDEX IF NOT EXISTS idx_escalations_issue ON escalations(issue_id);
CREATE INDEX IF NOT EXISTS idx_media_issue        ON media(issue_id);

SQL
  info "Schema applied."
}

# ─── Wait for LocalStack ──────────────────────────────────────────────────────
wait_for_localstack() {
  info "Waiting for LocalStack..."
  local retries=24
  until curl -sf "${LOCALSTACK_ENDPOINT}/_localstack/health" | grep -q '"s3"' 2>/dev/null; do
    retries=$((retries - 1))
    [ "$retries" -eq 0 ] && error "LocalStack did not become ready in time."
    sleep 3
  done
  info "LocalStack is ready."
}

# ─── Create S3 bucket ─────────────────────────────────────────────────────────
create_s3_bucket() {
  info "Creating S3 bucket '${S3_BUCKET}'..."
  aws --endpoint-url="${LOCALSTACK_ENDPOINT}" \
      --region="${AWS_REGION}" \
      s3 mb "s3://${S3_BUCKET}" 2>/dev/null \
    && info "Bucket created." \
    || warn "Bucket already exists — skipping."

  # Allow public read for media (adjust for prod)
  aws --endpoint-url="${LOCALSTACK_ENDPOINT}" \
      --region="${AWS_REGION}" \
      s3api put-bucket-cors \
      --bucket "${S3_BUCKET}" \
      --cors-configuration '{
        "CORSRules": [{
          "AllowedOrigins": ["*"],
          "AllowedHeaders": ["*"],
          "AllowedMethods": ["GET","PUT","POST","DELETE"],
          "MaxAgeSeconds": 3000
        }]
      }'
  info "CORS policy applied to bucket."
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "  प्रजाशक्ति — Local Dev Setup"
  echo "  ─────────────────────────────"
  echo ""

  # Load .env if present and DATABASE_URL not already set
  ENV_FILE="$(dirname "$0")/../apps/api/.env"
  if [ -f "$ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a; source "$ENV_FILE"; set +a
    info "Loaded env from ${ENV_FILE}"
  fi

  wait_for_postgres
  init_schema
  wait_for_localstack
  create_s3_bucket

  echo ""
  info "All done! Local services are ready."
  echo ""
  echo "  PostgreSQL : ${POSTGRES_URL}"
  echo "  Redis      : ${REDIS_URL:-redis://localhost:6379}"
  echo "  S3 bucket  : s3://${S3_BUCKET}  (${LOCALSTACK_ENDPOINT})"
  echo ""
}

main "$@"

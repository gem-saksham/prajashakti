locals {
  bucket_name = "${var.project_name}-media-${var.environment}"
}

# ── Bucket ────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "media" {
  bucket = local.bucket_name
  tags   = { Name = local.bucket_name }
}

# ── Block all public access ───────────────────────────────────────────────────

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Versioning ────────────────────────────────────────────────────────────────

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration {
    status = "Enabled"
  }
}

# ── Server-side encryption ────────────────────────────────────────────────────

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ── CORS ──────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = [
      "https://prajashakti.in",
      "https://www.prajashakti.in",
      "http://localhost:3000",
      "http://localhost:5173",
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ── Lifecycle rule — move to Infrequent Access after 90 days ──────────────────

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    # Expire non-current versions after 30 days
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

#!/bin/bash
# LocalStack S3 init script — runs automatically when LocalStack is ready.
# Creates the media bucket and configures CORS for local web dev.

set -e

BUCKET="prajashakti-media-dev"

echo "[localstack] Creating S3 bucket: $BUCKET"
awslocal s3 mb s3://${BUCKET} --region ap-south-1

echo "[localstack] Setting CORS policy on $BUCKET"
awslocal s3api put-bucket-cors \
  --bucket ${BUCKET} \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "DELETE", "POST", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders":  ["ETag"],
      "MaxAgeSeconds":  3600
    }]
  }'

echo "[localstack] S3 bucket $BUCKET ready"

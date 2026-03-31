# ─────────────────────────────────────────────────────────────────────────────
# Remote State Backend (S3 + DynamoDB)
#
# SETUP INSTRUCTIONS:
#   1. Create the S3 bucket for state:
#        aws s3api create-bucket \
#          --bucket prajashakti-tf-state \
#          --region ap-south-1 \
#          --create-bucket-configuration LocationConstraint=ap-south-1
#
#   2. Enable versioning on the bucket:
#        aws s3api put-bucket-versioning \
#          --bucket prajashakti-tf-state \
#          --versioning-configuration Status=Enabled
#
#   3. Create the DynamoDB table for state locking:
#        aws dynamodb create-table \
#          --table-name prajashakti-tf-locks \
#          --attribute-definitions AttributeName=LockID,AttributeType=S \
#          --key-schema AttributeName=LockID,KeyType=HASH \
#          --billing-mode PAY_PER_REQUEST \
#          --region ap-south-1
#
#   4. Uncomment the block below and run: terraform init
# ─────────────────────────────────────────────────────────────────────────────

# terraform {
#   backend "s3" {
#     bucket         = "prajashakti-tf-state"
#     key            = "infra/terraform.tfstate"
#     region         = "ap-south-1"
#     dynamodb_table = "prajashakti-tf-locks"
#     encrypt        = true
#   }
# }

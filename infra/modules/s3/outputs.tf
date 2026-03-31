output "bucket_name" {
  description = "S3 media bucket name"
  value       = aws_s3_bucket.media.bucket
}

output "bucket_arn" {
  description = "S3 media bucket ARN"
  value       = aws_s3_bucket.media.arn
}

output "bucket_regional_domain" {
  description = "Regional domain name for the bucket (use for pre-signed URL generation)"
  value       = aws_s3_bucket.media.bucket_regional_domain_name
}

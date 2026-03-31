# ── VPC ──────────────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.vpc.private_subnet_ids
}

# ── EKS ──────────────────────────────────────────────────────────────────────

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_ca_certificate" {
  description = "Base64-encoded certificate authority data for the cluster"
  value       = module.eks.cluster_ca_certificate
  sensitive   = true
}

output "eks_kubeconfig_command" {
  description = "AWS CLI command to update kubeconfig"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# ── RDS ──────────────────────────────────────────────────────────────────────

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (host:port)"
  value       = module.rds.endpoint
}

output "rds_db_name" {
  description = "PostgreSQL database name"
  value       = var.rds_db_name
}

output "rds_connection_string" {
  description = "PostgreSQL connection string (password omitted)"
  value       = "postgresql://${var.rds_username}:<PASSWORD>@${module.rds.endpoint}/${var.rds_db_name}"
  sensitive   = false
}

# ── Redis ─────────────────────────────────────────────────────────────────────

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.redis.endpoint
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://${module.redis.endpoint}:6379"
}

# ── S3 ───────────────────────────────────────────────────────────────────────

output "s3_bucket_name" {
  description = "Media S3 bucket name"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "Media S3 bucket ARN"
  value       = module.s3.bucket_arn
}

# ── IAM ──────────────────────────────────────────────────────────────────────

output "eks_cluster_role_arn" {
  description = "ARN of the EKS cluster IAM role"
  value       = module.iam.eks_cluster_role_arn
}

output "eks_node_role_arn" {
  description = "ARN of the EKS node group IAM role"
  value       = module.iam.eks_node_role_arn
}

output "ecr_repository_url" {
  description = "ECR repository URL for prajashakti-api"
  value       = module.iam.ecr_repository_url
}

output "api_s3_policy_arn" {
  description = "ARN of the IAM policy granting API service access to S3"
  value       = module.iam.api_s3_policy_arn
}

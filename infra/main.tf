terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

locals {
  common_tags = {
    Project     = "PrajaShakti"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ── VPC ──────────────────────────────────────────────────────────────────────

module "vpc" {
  source = "./modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
}

# ── IAM ──────────────────────────────────────────────────────────────────────

module "iam" {
  source = "./modules/iam"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
}

# ── Security Groups ───────────────────────────────────────────────────────────

module "security" {
  source = "./modules/security"

  project_name        = var.project_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  vpc_cidr            = var.vpc_cidr
  bastion_allowed_cidr = var.bastion_allowed_cidr
}

# ── EKS Cluster ───────────────────────────────────────────────────────────────

module "eks" {
  source = "./modules/eks"

  project_name          = var.project_name
  environment           = var.environment
  cluster_version       = var.eks_cluster_version
  private_subnet_ids    = module.vpc.private_subnet_ids
  cluster_role_arn      = module.iam.eks_cluster_role_arn
  node_role_arn         = module.iam.eks_node_role_arn
  cluster_sg_id         = module.security.eks_cluster_sg_id
  node_instance_type    = var.eks_node_instance_type
  node_min_size         = var.eks_node_min_size
  node_max_size         = var.eks_node_max_size
  node_desired_size     = var.eks_node_desired_size
}

# ── RDS PostgreSQL ────────────────────────────────────────────────────────────

module "rds" {
  source = "./modules/rds"

  project_name           = var.project_name
  environment            = var.environment
  private_subnet_ids     = module.vpc.private_subnet_ids
  rds_sg_id              = module.security.rds_sg_id
  instance_class         = var.rds_instance_class
  multi_az               = var.rds_multi_az
  db_name                = var.rds_db_name
  username               = var.rds_username
  password               = var.rds_password
  backup_retention_days  = var.rds_backup_retention_days
  allocated_storage_gb   = var.rds_allocated_storage_gb
}

# ── ElastiCache Redis ─────────────────────────────────────────────────────────

module "redis" {
  source = "./modules/redis"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.vpc.private_subnet_ids
  redis_sg_id        = module.security.redis_sg_id
  node_type          = var.redis_node_type
  num_cache_nodes    = var.redis_num_cache_nodes
}

# ── S3 Media Bucket ───────────────────────────────────────────────────────────

module "s3" {
  source = "./modules/s3"

  project_name = var.project_name
  environment  = var.environment
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ── DB Subnet Group ───────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Subnet group for PrajaShakti RDS (private subnets)"
  subnet_ids  = var.private_subnet_ids

  tags = { Name = "${local.name_prefix}-db-subnet-group" }
}

# ── RDS PostgreSQL Instance ───────────────────────────────────────────────────

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  engine               = "postgres"
  engine_version       = "16"
  instance_class       = var.instance_class
  allocated_storage    = var.allocated_storage_gb
  max_allocated_storage = var.allocated_storage_gb * 5 # Auto-scaling up to 5x

  db_name  = var.db_name
  username = var.username
  password = var.password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_sg_id]

  publicly_accessible     = false
  multi_az                = var.multi_az
  backup_retention_period = var.backup_retention_days
  backup_window           = "02:00-03:00"  # 2–3 AM IST is 20:30–21:30 UTC
  maintenance_window      = "sun:03:00-sun:04:00"

  storage_encrypted = true
  storage_type      = "gp3"

  # Prevent accidental deletion in prod
  deletion_protection      = var.environment == "prod"
  skip_final_snapshot      = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${local.name_prefix}-final-snapshot" : null

  # Performance Insights (free tier for t3 instances)
  performance_insights_enabled = false

  tags = { Name = "${local.name_prefix}-postgres" }
}

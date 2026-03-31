locals {
  name_prefix = "${var.project_name}-${var.environment}"
  is_cluster  = var.num_cache_nodes > 1
}

# ── Subnet Group ──────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name_prefix}-redis-subnet-group"
  description = "Subnet group for PrajaShakti Redis (private subnets)"
  subnet_ids  = var.private_subnet_ids

  tags = { Name = "${local.name_prefix}-redis-subnet-group" }
}

# ── Dev: Single-node Redis cluster ────────────────────────────────────────────

resource "aws_elasticache_cluster" "single" {
  count = local.is_cluster ? 0 : 1

  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [var.redis_sg_id]

  # Maintenance window is 3–4 AM IST (21:30–22:30 UTC on Sunday)
  maintenance_window = "sun:21:30-sun:22:30"
  snapshot_retention_limit = 1

  tags = { Name = "${local.name_prefix}-redis" }
}

# ── Prod: Replication group ───────────────────────────────────────────────────

resource "aws_elasticache_replication_group" "cluster" {
  count = local.is_cluster ? 1 : 0

  replication_group_id = "${local.name_prefix}-redis"
  description          = "PrajaShakti Redis replication group (${var.environment})"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.redis_sg_id]

  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  maintenance_window       = "sun:21:30-sun:22:30"
  snapshot_retention_limit = 7
  snapshot_window          = "02:00-03:00"

  tags = { Name = "${local.name_prefix}-redis" }
}

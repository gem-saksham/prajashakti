locals {
  cluster_name = "${var.project_name}-cluster"
}

# ── EKS Cluster ───────────────────────────────────────────────────────────────

resource "aws_eks_cluster" "main" {
  name     = local.cluster_name
  role_arn = var.cluster_role_arn
  version  = var.cluster_version

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    security_group_ids      = [var.cluster_sg_id]
    endpoint_private_access = true
    endpoint_public_access  = true # Set to false once VPN/bastion is in place
  }

  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler",
  ]

  tags = { Name = local.cluster_name }
}

# ── Managed Node Group ────────────────────────────────────────────────────────

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project_name}-${var.environment}-nodes"
  node_role_arn   = var.node_role_arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = [var.node_instance_type]

  scaling_config {
    min_size     = var.node_min_size
    max_size     = var.node_max_size
    desired_size = var.node_desired_size
  }

  update_config {
    max_unavailable = 1
  }

  # Allow external changes to desired_size without Terraform drift
  lifecycle {
    ignore_changes = [scaling_config[0].desired_size]
  }

  tags = { Name = "${var.project_name}-${var.environment}-nodes" }
}

# ── aws-auth ConfigMap (allows nodes to join) ─────────────────────────────────
# Note: In EKS ≥1.29 with access entries enabled you can manage this via
# aws_eks_access_entry instead. Kept here for broad compatibility.

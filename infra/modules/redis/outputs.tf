output "endpoint" {
  description = "Redis primary endpoint hostname"
  value = (
    length(aws_elasticache_cluster.single) > 0
    ? aws_elasticache_cluster.single[0].cache_nodes[0].address
    : aws_elasticache_replication_group.cluster[0].primary_endpoint_address
  )
}

output "port" {
  description = "Redis port"
  value       = 6379
}

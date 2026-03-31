variable "project_name"          { type = string }
variable "environment"           { type = string }
variable "private_subnet_ids"    { type = list(string) }
variable "rds_sg_id"             { type = string }
variable "instance_class"        { type = string }
variable "multi_az"              { type = bool }
variable "db_name"               { type = string }
variable "username"              { type = string }
variable "password"              { type = string; sensitive = true }
variable "backup_retention_days" { type = number }
variable "allocated_storage_gb"  { type = number }

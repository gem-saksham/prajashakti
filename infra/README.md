# PrajaShakti — AWS Infrastructure

Terraform-managed AWS infrastructure for the PrajaShakti civic platform.
All resources are tagged `Project=PrajaShakti`, `Environment=<env>`, `ManagedBy=Terraform`.

## Architecture Overview

```
ap-south-1 (Mumbai)
└── VPC 10.0.0.0/16
    ├── Public subnets  (10.0.1.0/24, 10.0.2.0/24) — NAT Gateways, Load Balancers
    └── Private subnets (10.0.3.0/24, 10.0.4.0/24)
        ├── EKS Managed Node Group (t3.medium × 2–5)
        ├── RDS PostgreSQL 16
        └── ElastiCache Redis 7
```

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Terraform | ≥ 1.6 | https://developer.hashicorp.com/terraform/install |
| AWS CLI | ≥ 2.x | https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html |
| kubectl | ≥ 1.29 | https://kubernetes.io/docs/tasks/tools/ |

Configure your AWS credentials before running any commands:

```bash
aws configure
# or
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=ap-south-1
```

## First-Time Remote State Setup (Recommended)

Before applying, create the S3 bucket and DynamoDB table for Terraform state:

```bash
# 1. Create state bucket
aws s3api create-bucket \
  --bucket prajashakti-tf-state \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# 2. Enable versioning
aws s3api put-bucket-versioning \
  --bucket prajashakti-tf-state \
  --versioning-configuration Status=Enabled

# 3. Create DynamoDB lock table
aws dynamodb create-table \
  --table-name prajashakti-tf-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# 4. Uncomment the backend block in backend.tf, then re-run:
terraform init
```

## Step-by-Step Setup

### 1. Clone and enter the infra directory

```bash
cd infra/
```

### 2. Create your variable file

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your real values
```

Set the RDS password via environment variable (never commit it):

```bash
export TF_VAR_rds_password="your-very-secure-password-here"
```

### 3. Initialise Terraform

```bash
terraform init
```

### 4. Preview the plan

```bash
# Dev environment
terraform plan -var-file=environments/dev.tfvars

# Prod environment
terraform plan -var-file=environments/prod.tfvars
```

### 5. Apply

```bash
# Dev
terraform apply -var-file=environments/dev.tfvars

# Prod (requires explicit approval)
terraform apply -var-file=environments/prod.tfvars
```

### 6. Connect kubectl to EKS

After apply, run the command printed in the `eks_kubeconfig_command` output:

```bash
aws eks update-kubeconfig \
  --region ap-south-1 \
  --name prajashakti-cluster

# Verify
kubectl get nodes
```

## Switching Between Environments

All environment differences are captured in `environments/dev.tfvars` and
`environments/prod.tfvars`. Pass the appropriate file with `-var-file`:

```bash
# Switch to prod workspace (keeps state separate)
terraform workspace new prod
terraform workspace select prod
terraform apply -var-file=environments/prod.tfvars

# Switch back to dev
terraform workspace select dev
terraform apply -var-file=environments/dev.tfvars
```

> **Tip:** Use separate Terraform workspaces _or_ separate state keys in `backend.tf`
> (e.g. `key = "infra/dev/terraform.tfstate"`) to keep dev and prod state isolated.

## Teardown

```bash
# Remove all resources (be careful in prod!)
terraform destroy -var-file=environments/dev.tfvars
```

## Connecting to Services

### PostgreSQL (via kubectl port-forward)

```bash
kubectl run psql-client --rm -it --image=postgres:16 -- \
  psql "postgresql://<username>:<password>@<rds_endpoint>/prajashakti"
```

### Redis (via kubectl port-forward)

```bash
kubectl run redis-client --rm -it --image=redis:7 -- \
  redis-cli -h <redis_endpoint> -p 6379
```

## Estimated Monthly Costs

Costs are approximate for ap-south-1 (Mumbai). Check the [AWS Pricing Calculator](https://calculator.aws) for exact figures.

| Service | Dev | Prod |
|---------|-----|------|
| EKS Cluster | ~$72 (control plane) | ~$72 |
| EC2 Nodes (t3.medium × 2) | ~$27 | ~$40 (×3 desired) |
| RDS db.t3.micro (single-AZ) | ~$15 | — |
| RDS db.t3.medium (Multi-AZ) | — | ~$90 |
| ElastiCache cache.t3.micro | ~$12 | — |
| ElastiCache cache.t3.medium × 2 | — | ~$72 |
| NAT Gateways (×2) | ~$65 | ~$65 |
| S3 + data transfer | ~$2 | ~$10+ |
| **Total (approx.)** | **~$193/mo** | **~$350/mo** |

> NAT Gateways are the biggest cost driver. For dev, you can reduce to 1 NAT GW
> by using a single private subnet — edit `modules/vpc/main.tf` accordingly.

## Key Outputs After Apply

```
eks_cluster_name        = "prajashakti-cluster"
eks_cluster_endpoint    = "https://..."
eks_kubeconfig_command  = "aws eks update-kubeconfig ..."
rds_endpoint            = "prajashakti-dev-postgres.xxxx.ap-south-1.rds.amazonaws.com:5432"
rds_connection_string   = "postgresql://prajashakti_admin:<PASSWORD>@.../prajashakti"
redis_endpoint          = "prajashakti-dev-redis.xxxx.cfg.aps1.cache.amazonaws.com"
redis_connection_string = "redis://....:6379"
s3_bucket_name          = "prajashakti-media-dev"
ecr_repository_url      = "123456789.dkr.ecr.ap-south-1.amazonaws.com/prajashakti-api"
```

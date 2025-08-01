# Pulumi Kubernetes Infrastructure

A Pulumi TypeScript project that provisions AWS EKS clusters with VPC networking and FluxCD GitOps deployment capabilities.

## 🏗️ Architecture

This project creates:
- **VPC & Networking**: Multi-AZ VPC with public/private subnets
- **EKS Cluster**: Managed Kubernetes cluster with worker node groups
- **FluxCD**: GitOps continuous deployment with Helm
- **Git Integration**: Automated sync with GitHub repositories

## 📋 Prerequisites

### Local Development

#### Required Tools
```bash
# Node.js & Package Manager
node --version  # >= 18.x
pnpm --version  # >= 8.x (or npm/yarn)

# Pulumi CLI
pulumi version  # >= 3.x

# AWS CLI
aws --version   # >= 2.x

# Kubernetes CLI (optional)
kubectl version # >= 1.28
```

#### AWS Configuration
```bash
# Configure AWS credentials
aws configure
# OR set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key" 
export AWS_REGION="ap-southeast-1"
```

#### AWS IAM Permissions
Your AWS user/role needs these permissions:
- `EC2FullAccess` - VPC and networking
- `EKSClusterServiceRolePolicy` - EKS cluster management
- `EKSWorkerNodeGroupPolicy` - Worker node management
- `IAMFullAccess` - Role creation for EKS
- `S3FullAccess` - Pulumi state storage

### Stack-Specific AWS Profiles
Configure profiles for each environment:
```bash
# ~/.aws/config
[profile dev-profile]
region = ap-southeast-1
role_arn = arn:aws:iam::123456789012:role/PulumiDeploymentRole

[profile staging-profile] 
region = us-west-1
role_arn = arn:aws:iam::123456789012:role/PulumiDeploymentRole-Staging

[profile prod-profile]
region = us-east-1  
role_arn = arn:aws:iam::456789012345:role/PulumiDeploymentRole-Prod
```

## 🚀 Local Setup

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Initialize Pulumi Stack
```bash
# Create and select stack
pulumi stack init dev
pulumi stack select dev

# Configure AWS profiles
pulumi config set aws:dev-profile "dev-profile"
pulumi config set aws:staging-profile "staging-profile" 
pulumi config set aws:prod-profile "prod-profile"
```

### 3. Configure GitHub Access
```bash
# Set GitHub token for private repositories
pulumi config set --secret github-token "ghp_your_github_token_here"
```

### 4. Deploy Infrastructure
```bash
# Preview changes
pulumi preview

# Deploy to AWS
pulumi up
```

### 5. Connect to Cluster
```bash
# Get kubeconfig
pulumi stack output kubeconfig --show-secrets > kubeconfig.yaml
export KUBECONFIG=./kubeconfig.yaml

# Verify connection
kubectl get nodes
kubectl get pods -n flux-system
```

## 🔄 CI/CD Setup

### GitHub Actions Requirements

#### 1. Repository Secrets
Set these secrets in your GitHub repository:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Pulumi Access Token
PULUMI_ACCESS_TOKEN=pul-your-token-here

# GitHub Token for FluxCD
GITHUB_TOKEN=ghp_your_token_here
```

#### 2. IAM Roles for OIDC (Recommended)
```yaml
# Create OIDC provider and roles
AssumeRolePolicyDocument:
  Version: "2012-10-17"
  Statement:
    - Effect: Allow
      Principal:
        Federated: arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com
      Action: sts:AssumeRoleWithWebIdentity
      Condition:
        StringEquals:
          token.actions.githubusercontent.com:aud: sts.amazonaws.com
          token.actions.githubusercontent.com:sub: repo:your-org/your-repo:ref:refs/heads/main
```

#### 3. Example GitHub Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-1
          
      - name: Deploy with Pulumi
        uses: pulumi/actions@v4
        with:
          command: up
          stack-name: dev
        env:
          PULUMI_ACCESS_TOKEN: ${{ secrets.PULUMI_ACCESS_TOKEN }}
```

### Alternative: Pulumi Cloud Deployments
```bash
# Set up Pulumi Deployments
pulumi config set --secret github-token ${{ secrets.GITHUB_TOKEN }}
pulumi deployment settings set --create-default-settings
```

## 🔧 Configuration

### Environment-Specific Settings

Edit `config/environments.ts` to customize:
- EKS versions and node group sizes
- VPC CIDR blocks and availability zones  
- RDS instance classes and storage

Edit `config/aws-config.ts` to update:
- AWS regions per environment
- IAM role ARNs
- Account IDs

### Adding New Applications

```typescript
// In index.ts - Add new FluxApp
const newApp = new FluxApp(`${stack}-new-app`, {
    kubernetesProvider: kubernetes.provider,
    name: "new-application",
    namespace: "new-app-namespace", 
    gitRepository: {
        name: "example-app-1", // Reference existing GitRepository
        path: "./new-app/deploy",
    },
    kustomization: {
        interval: "5m",
        prune: true,
    },
});
```

## 📁 Project Structure

```
pulumi-k8s/
├── config/
│   ├── aws-config.ts          # AWS provider & role configuration
│   └── environments.ts        # Environment-specific settings
├── modules/
│   ├── networking/            # VPC, subnets, security groups
│   ├── k8s/                  # EKS cluster and node groups
│   └── components/
│       └── flux-cd/          # FluxCD, GitOps, credentials
├── index.ts                  # Main infrastructure definition
├── package.json             # Dependencies
└── Pulumi.yaml             # Project configuration
```

## 🔍 Troubleshooting

### Common Issues

**AWS Credentials**
```bash
# Verify AWS access
aws sts get-caller-identity

# Check assumed role
aws sts assume-role --role-arn arn:aws:iam::ACCOUNT:role/ROLE --role-session-name test
```

**EKS Connection**
```bash
# Update kubeconfig
aws eks update-kubeconfig --region REGION --name CLUSTER_NAME

# Check cluster status
kubectl get nodes
kubectl get pods --all-namespaces
```

**FluxCD Issues**
```bash
# Check Flux controllers
kubectl get pods -n flux-system

# View GitRepository status
kubectl get gitrepository -n flux-system

# Check Kustomization status  
kubectl get kustomization -n flux-system
```

**GitHub Token Permissions**
Ensure your token has:
- `repo` scope for private repositories
- `read:packages` for GitHub Container Registry
- Set expiration to 90 days or less

## 📚 Additional Resources

- [Pulumi Kubernetes Provider](https://www.pulumi.com/registry/packages/kubernetes/)
- [AWS EKS Documentation](https://docs.aws.amazon.com/eks/)
- [FluxCD Documentation](https://fluxcd.io/docs/)
- [Pulumi Deployments](https://www.pulumi.com/docs/pulumi-cloud/deployments/)

## 🔒 Security Best Practices

- Store secrets in Pulumi ESC or AWS Secrets Manager
- Use IAM roles with least-privilege permissions
- Enable EKS cluster logging and monitoring
- Regularly rotate GitHub tokens and AWS keys
- Use separate AWS accounts for prod environments
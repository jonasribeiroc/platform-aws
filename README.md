# User Profile API - AWS Infrastructure

A serverless user profile API deployed on AWS using ECS Fargate, RDS PostgreSQL, Amazon Cognito, and API Gateway.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  API Gateway    │────▶│   ECS Fargate   │
│  + Cognito Auth │     │   (Backend)     │
└─────────────────┘     └────────┬────────┘
                                  │
        ┌─────────────────┐      │
        │     Cognito     │◀─────┤
        │   (User Pool)   │      │
        └─────────────────┘      │
                                  │
        ┌─────────────────┐      │
        │  SSM Parameter  │──────┤
        │  (System Secret)│      │
        └─────────────────┘      ▼
                        ┌─────────────────┐
                        │       RDS       │
                        │  (PostgreSQL)   │
                        └─────────────────┘
```

## Components

- **Backend**: Node.js/TypeScript API running on ECS Fargate
- **Database**: RDS PostgreSQL (db.t3.micro)
- **Authentication**: Amazon Cognito User Pool
- **Secrets Management**: AWS SSM Parameter Store
- **Infrastructure**: CloudFormation template
- **CI/CD**: GitHub Actions workflow

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/profile` | GET | Yes | Get user profile (by Cognito sub) |
| `/profile` | PUT | Yes | Update user profile |
| `/system/secret` | GET | Yes | Return the injected SSM secret |

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Docker installed
- Node.js 18+ and npm
- GitHub repository with Actions enabled

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd aws-test
```

### 2. Build the Backend

```bash
cd backend
npm install
npm run build
```

### 3. Deploy Infrastructure

#### Step 1: Create the CloudFormation Stack

```bash
cd infrastructure

# Generate a secure database password (min 8 characters)
# Save it securely - you'll need it for the stack creation

aws cloudformation create-stack \
  --stack-name user-profile-api \
  --template-body file://template.yaml \
  --parameters ParameterKey=DBPassword,ParameterValue=YourSecurePassword123! \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

**Note**: Replace `YourSecurePassword123!` with a strong password (minimum 8 characters).

#### Step 2: Wait for Stack Creation

```bash
aws cloudformation wait stack-create-complete \
  --stack-name user-profile-api \
  --region us-east-1
```

This process typically takes 15-20 minutes as it creates:
- VPC and networking components
- RDS PostgreSQL instance
- ECS cluster and service
- Application Load Balancer
- API Gateway
- Cognito User Pool

#### Step 3: Get Stack Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name user-profile-api \
  --query 'Stacks[0].Outputs' \
  --region us-east-1
```

Save these values:
- `UserPoolId`
- `UserPoolClientId`
- `APIGatewayURL`
- `RDSEndpoint`
- `ECSClusterArn`

### 4. Build and Push Docker Image

#### Step 1: Get ECR Login Token

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
```

Replace `<account-id>` with your AWS account ID.

#### Step 2: Build and Push Image

```bash
# Get the ECR repository URI from stack outputs
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name user-profile-api \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
  --output text \
  --region us-east-1)

# Build the image
cd backend
docker build -t user-profile-api:latest .

# Tag and push
docker tag user-profile-api:latest $ECR_URI:latest
docker push $ECR_URI:latest
```

### 5. Configure GitHub Actions

#### Step 1: Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

- `AWS_ACCESS_KEY_ID`: Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key
- `AWS_REGION`: AWS region (e.g., `us-east-1`)

**Important**: Use an IAM user with the following minimum permissions:
- ECR: `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`
- ECS: `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices`
- CloudFormation: `cloudformation:DescribeStacks`, `cloudformation:ListStacks`

### 6. Test the API

#### Step 1: Create a Test User in Cognito

```bash
# Get Cognito User Pool ID
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name user-profile-api \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --region us-east-1)

# Create a test user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \
  --temporary-password TempPass123! \
  --region us-east-1

# Set permanent password (requires admin)
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --password YourPassword123! \
  --permanent \
  --region us-east-1
```

#### Step 2: Get Authentication Token

```bash
# Get Client ID
CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name user-profile-api \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text \
  --region us-east-1)

# Authenticate and get token
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id $CLIENT_ID \
  --auth-parameters USERNAME=testuser@example.com,PASSWORD=YourPassword123! \
  --region us-east-1
```

Copy the `IdToken` from the response.

#### Step 3: Test Endpoints

```bash
# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name user-profile-api \
  --query 'Stacks[0].Outputs[?OutputKey==`APIGatewayURL`].OutputValue' \
  --output text \
  --region us-east-1)

# Health check (no auth required)
curl $API_URL/health

# Get profile (requires auth)
curl -H "Authorization: Bearer YOUR_ID_TOKEN" $API_URL/profile

# Update profile
curl -X PUT \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"John","last_name":"Doe"}' \
  $API_URL/profile

# Get system secret
curl -H "Authorization: Bearer YOUR_ID_TOKEN" $API_URL/system/secret
```

## Database Schema

```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The table is automatically created when the ECS task starts for the first time.

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:

1. Builds the Docker image on push to `main` branch
2. Pushes the image to Amazon ECR
3. Updates the ECS task definition with the new image
4. Deploys the new task definition to the ECS service
5. Waits for the service to stabilize

## Cost Considerations

This stack uses AWS Free Tier eligible resources:

- **Cognito**: 50,000 MAUs free
- **API Gateway**: 1M calls/month free
- **RDS**: 750 hours/month db.t3.micro (12 months)
- **ECS Fargate**: 750 hours/month (12 months)

**Important**: Delete the stack after evaluation to avoid charges:

```bash
aws cloudformation delete-stack --stack-name user-profile-api --region us-east-1
```

## Troubleshooting

### ECS Service Not Starting

1. Check CloudWatch Logs:
```bash
aws logs tail /ecs/user-profile-api --follow --region us-east-1
```

2. Check ECS service events:
```bash
aws ecs describe-services \
  --cluster user-profile-api-cluster \
  --services user-profile-api-service \
  --region us-east-1
```

### Database Connection Issues

1. Verify security groups allow traffic from ECS to RDS
2. Check RDS endpoint is correct in task definition
3. Verify database password is correctly set in Secrets Manager

### API Gateway 502 Errors

1. Check ALB target group health:
```bash
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn> \
  --region us-east-1
```

2. Verify ECS tasks are running:
```bash
aws ecs list-tasks --cluster user-profile-api-cluster --region us-east-1
```

### Authentication Issues

1. Verify Cognito User Pool ID and Client ID are correct
2. Check token expiration (default is 1 hour)
3. Ensure user is confirmed in Cognito

## Project Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD workflow
├── infrastructure/
│   └── template.yaml           # CloudFormation template
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts     # Database connection
│   │   ├── middleware/
│   │   │   └── auth.ts         # Cognito authentication
│   │   ├── routes/
│   │   │   ├── health.ts       # Health check endpoint
│   │   │   ├── profile.ts      # Profile endpoints
│   │   │   └── system.ts       # System secret endpoint
│   │   ├── services/
│   │   │   └── profileService.ts
│   │   └── index.ts            # Express server
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Security Notes

- Database password is stored in AWS Secrets Manager
- System secret is stored in SSM Parameter Store (SecureString)
- All API endpoints except `/health` require Cognito authentication
- RDS is in private subnets, not publicly accessible
- Security groups restrict traffic between components

## License

This project is provided as-is for assessment purposes.


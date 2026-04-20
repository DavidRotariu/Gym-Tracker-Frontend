# Frontend EC2 Deployment Guide (ECR + SSM)

This repository deploys frontend using EC2, not ECS.

Pipeline location:
1. `.github/workflows/deploy-ec2-ssm.yml`

Deployment flow:
1. GitHub Actions assumes AWS IAM role via OIDC.
2. Builds production Docker image for Next.js.
3. Pushes image to ECR using immutable SHA tag and `prod-latest`.
4. Uses SSM Run Command to deploy on EC2 instance.
5. Runs health check on localhost and rolls back on failure.

## 1) Current architecture (no ALB)

Traffic model:
1. `gym-tracker.website` points to EC2 Elastic IP.
2. Nginx listens on 80/443 on EC2.
3. Nginx reverse proxies to local container on `127.0.0.1:3000`.

Container is not exposed publicly:
1. Docker publish binding uses loopback only (`127.0.0.1:3000:3000`).

## 2) AWS prerequisites

Required resources:
1. ECR repository for frontend image.
2. EC2 instance with Docker, AWS CLI, and SSM agent.
3. IAM role attached to EC2 instance that can read the frontend SSM parameter.
4. IAM role attached to EC2 instance that can pull images from ECR.
5. IAM deploy role for GitHub OIDC.

## 3) GitHub secret and variables

Repository secret:
1. `AWS_DEPLOY_ROLE_ARN`

Repository variables:
1. `AWS_REGION`
2. `ECR_REPOSITORY`
3. `EC2_INSTANCE_ID`
4. `FRONTEND_ENV_SSM_PARAM` (example: `/gym-tracker/prod/frontend/env`)
5. `APP_CONTAINER_NAME` (optional, defaults to `gym-tracker-frontend`)
6. `APP_PORT` (optional, defaults to `3000`)
7. `BACKEND_BASE_URL` (example: `https://api.gym-tracker.website`)
8. `NEXT_PUBLIC_BASE_URL` (example: `https://api.gym-tracker.website`)
9. `AUTH_COOKIE_NAME` (example: `gym_tracker_access_token`)

## 4) SSM parameter content

Store frontend runtime environment in SSM SecureString as plain env file content.

Example value:
1. `BACKEND_BASE_URL=https://api.gym-tracker.website`
2. `NEXT_PUBLIC_BASE_URL=https://api.gym-tracker.website`
3. `AUTH_COOKIE_NAME=gym_tracker_access_token`

## 5) Triggering deployment

Deployment runs on push to `main` (selected paths) and manual dispatch.

## 6) Recommended hardening

1. Keep EC2 security group open publicly only for 80/443.
2. Keep backend/app ports private on localhost.
3. Enable ECR scan on push.
4. Add CloudWatch alarms for 5xx and instance health.

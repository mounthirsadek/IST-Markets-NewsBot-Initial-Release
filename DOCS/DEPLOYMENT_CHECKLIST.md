# Deployment Checklist - IST Markets NewsBot

## 1. Environment Setup
- [ ] **Local Development**: Ensure `npm run dev` works with a local `.env` file.
- [ ] **Staging Environment**: Deploy to a separate Cloud Run service for testing.
- [ ] **Production Environment**: Final deployment with production-grade secrets.

## 2. Required Setup
- [ ] **CI/CD Pipeline**: Automate builds and deployments via GitHub Actions.
- [ ] **Environment Secrets**: Securely store all API keys (Gemini, FMP, Meta).
- [ ] **Database Backups**: Enable Firestore daily backups and point-in-time recovery.
- [ ] **Monitoring**: Set up Google Cloud Monitoring for CPU/Memory usage.
- [ ] **Error Tracking**: Integrate Sentry or Google Cloud Error Reporting.
- [ ] **Uptime Alerts**: Configure Uptime Checks with email/Slack notifications.

## 3. Pre-Launch Verification
- [ ] **Security Audit**: Verify Firestore rules against red-team attacks.
- [ ] **Performance Test**: Ensure AI generation completes within 30 seconds.
- [ ] **Bilingual Check**: Confirm EN/AR content is correctly translated and formatted.
- [ ] **Publishing Test**: Successfully publish a test story to a sandbox Instagram account.
- [ ] **Audit Log Verification**: Every action must be logged in the `audit_logs` collection.

## 4. Rollback & Disaster Recovery
- [ ] **Rollback Strategy**: Document how to revert to the previous stable version.
- [ ] **Data Recovery**: Test restoring Firestore data from a backup.
- [ ] **API Failover**: Document manual fallback procedures for external API failures.

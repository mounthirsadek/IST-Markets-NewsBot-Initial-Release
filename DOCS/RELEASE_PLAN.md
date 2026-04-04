# Release Plan - IST Markets NewsBot

## Release 1 — MVP (Current)
**Goal:** Establish the core automated news-to-social-media pipeline.
- **Target Audience:** Internal editorial team.
- **Key Features:**
  - Instagram feed publishing (EN/AR).
  - AI-powered news fetching and safety filtering.
  - Bilingual (EN/AR) rewriting and image generation.
  - Basic operational dashboard and audit logs.
- **Success Criteria:** 100% of core flows pass E2E testing in staging.

## Release 2 — Operational Efficiency
**Goal:** Improve scheduling and content management.
- **Target Audience:** Content managers and social media leads.
- **Key Features:**
  - **Content Calendar:** Visual grid view of all scheduled and published stories.
  - **Scheduling Queue:** Dashboard for managing the publishing order.
  - **Duplicate Detection:** AI-powered check to prevent publishing similar news twice.
  - **Stronger Analytics:** Detailed performance metrics (impressions, engagement) per story.

## Release 3 — Platform Expansion
**Goal:** Scale to multiple platforms and advanced insights.
- **Target Audience:** Marketing and growth teams.
- **Key Features:**
  - **Multi-platform Publishing:** Support for LinkedIn, Twitter (X), and Telegram.
  - **Hashtag Performance Tracker:** Analytics on which hashtags drive the most reach.
  - **Performance Alerts:** Real-time notifications for high-performing stories.
  - **Trending Topics Overlay:** Real-time market trends integrated into the news feed.

## Suggested Timeline (6 Sprints)
| Sprint | Focus | Deliverables |
|--------|-------|--------------|
| **Sprint 1** | Discovery & Foundations | Architecture, Auth, RBAC, API Setup. |
| **Sprint 2** | News & Safety | FMP Integration, Safety Filter, Selection UI. |
| **Sprint 3** | AI Rewrite | Gemini 3.1 Pro integration, EN/AR translation. |
| **Sprint 4** | Visuals & Brand | Gemini 2.5 Flash Image, Branded Canvas, Settings. |
| **Sprint 5** | Captions & Publishing | Meta API integration, Instagram Feed publishing. |
| **Sprint 6** | Audit & Hardening | Archive, Audit Logs, Analytics, E2E Testing. |

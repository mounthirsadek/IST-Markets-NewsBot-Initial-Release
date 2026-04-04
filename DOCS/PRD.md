# IST Markets NewsBot - Product Requirements Document (PRD)

## 1. Project Overview
IST Markets NewsBot is an automated news automation and publishing platform designed for financial markets. It fetches news, filters for safety, rewrites content for social media (Instagram), generates visuals, and publishes/schedules posts.

## 2. Personas & Roles
- **Super Admin**: Full system access, API configuration, user management.
- **Admin**: System settings, user role management.
- **Senior Editor**: Approval of stories, scheduling, and publishing.
- **Editor**: Fetching news, AI rewriting, image generation, draft creation.
- **Viewer**: Read-only access to dashboard and archive.

## 3. MVP Scope (Phase 1)
### Functional Requirements
- **Auth + Roles**: Firebase Authentication (Google Login) with Firestore-based RBAC.
- **News Fetching**: Manual trigger to fetch the latest 5 news items from financial APIs (FMP).
- **Safety Filter**: AI-powered screening of news for sensitive or prohibited content.
- **Selection UI**: Interface to review fetched news and select articles for processing.
- **AI Rewriting**: Bilingual (EN/AR) rewriting of news into Instagram-friendly formats using Gemini 3.1 Pro.
- **Image Generation**: AI-generated visuals for stories using Gemini 2.5 Flash Image.
- **Caption & Hashtags**: Automated generation of engaging captions and relevant hashtags.
- **Instagram Publishing**: Integration with Meta Business API for direct publishing.
- **Archive & Audit**: History of all fetched news and published stories.
- **Dashboard**: High-level analytics and operational status.

### Non-Functional Requirements
- **Performance**: AI generation should complete within 30 seconds.
- **Security**: Strict Firestore rules to protect PII and administrative functions.
- **Scalability**: Stateless backend capable of handling multiple concurrent editorial sessions.

## 4. API Dependency Sheet
| Service | Provider | Purpose |
|---------|----------|---------|
| News Data | Financial Modeling Prep (FMP) | Source of market news |
| LLM | Google Gemini 3.1 Pro | Rewriting, translation, safety filtering |
| Image Gen | Google Gemini 2.5 Flash Image | Visual content creation |
| Publishing | Meta Business API | Instagram Feed publishing |
| Database | Firebase Firestore | State management and storage |
| Auth | Firebase Auth | User identity |

## 5. Risk Register
| Risk | Impact | Mitigation |
|------|--------|------------|
| API Rate Limits | High | Implement caching and request throttling |
| AI Hallucinations | Medium | Human-in-the-loop editorial review |
| Meta API Changes | High | Abstract publishing layer for quick updates |
| Data Privacy | Medium | Strict RBAC and minimal PII storage |

## 6. Definition of Done (DoD)
- Code passes linting and compilation.
- Feature meets all functional requirements in MVP scope.
- Security rules verified against red-team attack vectors.
- UI is responsive and follows the "Technical Dashboard" design recipe.

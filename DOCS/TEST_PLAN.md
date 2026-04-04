# Test Plan - IST Markets NewsBot

## 1. Unit Testing Strategy
Focus on pure logic and utility functions.
- **Safety Filter Rules**: Test `geminiService` logic for identifying 'unsafe' vs 'safe' content.
- **Theme Classifier**: Verify that news items are correctly categorized into themes (e.g., Crypto, Stocks, Forex).
- **Caption Generation**: Ensure captions follow the required bilingual (EN/AR) structure.
- **Permission Checks**: Validate `checkRole` middleware in `server.ts`.

## 2. Integration Testing Strategy
Verify the interaction between components and external APIs.
- **FMP Fetch Flow**: Test the `/api/news/fetch` endpoint with mock and real FMP responses.
- **AI Rewrite Flow**: Validate the end-to-end rewrite process from raw news to structured EN/AR content.
- **Image Generation Flow**: Ensure base64 image data is correctly received from Gemini and displayed in the UI.
- **Publish Flow**: Test the `/api/publish` endpoint with the Meta Business API (using sandbox/test accounts).
- **Archive Logging**: Verify that every action (fetch, rewrite, publish) creates a corresponding `audit_log` entry.

## 3. End-to-End (E2E) Testing Strategy
Simulate real user journeys in a staging environment.
- **Core Flow**: Login → Fetch News → Select Article → Rewrite → Generate Image → Generate Caption → Publish to Instagram.
- **Schedule Flow**: Verify that stories can be scheduled for future dates and appear in the archive as 'scheduled'.
- **Retry Flow**: Simulate an API failure (e.g., Gemini timeout) and verify the "Retry" button appears and works.
- **Failure Handling**: Ensure the UI displays clear error messages when services are unavailable.

## 4. Failure Scenarios & Mitigation
| Scenario | Expected System Behavior |
|----------|--------------------------|
| **FMP Unavailable** | Show "News source currently unavailable" message; allow manual news entry. |
| **AI Unavailable** | Show "AI Service busy" message; preserve current draft; provide "Retry" button. |
| **Image Provider Unavailable** | Show "Image generation failed" message; allow manual image upload as fallback. |
| **Meta Publish Failed** | Show "Instagram publishing failed" with specific error; preserve story in 'draft' state. |

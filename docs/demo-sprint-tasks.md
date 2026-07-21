---
markmap:
  colorFreezeLevel: 2
  initialExpandLevel: 4
  maxWidth: 340
---

# Demo Sprint

## Backend
### <span style="background:#e53935;color:#fff;border-radius:4px;padding:0 6px;">1</span> Set up CI pipeline
- Run lint + unit tests on every push
- Cache dependencies between runs
### <span style="background:#fb8c00;color:#fff;border-radius:4px;padding:0 6px;">2</span> Add authentication middleware
- JWT-based session tokens
- Refresh token rotation
### <span style="background:#fdd835;color:#333;border-radius:4px;padding:0 6px;">3</span> Migrate database schema
- Add indexes for search queries
- Backfill existing records

## Frontend
### <span style="background:#e53935;color:#fff;border-radius:4px;padding:0 6px;">1</span> Design login flow
- Wireframes for desktop + mobile
- Error state handling
### <span style="background:#43a047;color:#fff;border-radius:4px;padding:0 6px;">4</span> Build settings page
- Theme toggle
- Notification preferences
### <span style="background:#1e88e5;color:#fff;border-radius:4px;padding:0 6px;">5</span> Polish onboarding tour
- First-run tooltips
- Skip/replay controls

## QA
### <span style="background:#fb8c00;color:#fff;border-radius:4px;padding:0 6px;">2</span> Write end-to-end test suite
- Cover critical user journeys
- Run against staging nightly
### <span style="background:#fdd835;color:#333;border-radius:4px;padding:0 6px;">3</span> Set up bug triage board
- Weekly grooming
- Severity labels

## Release
### <span style="background:#e53935;color:#fff;border-radius:4px;padding:0 6px;">1</span> Prepare changelog
- Summarize user-facing changes
### <span style="background:#43a047;color:#fff;border-radius:4px;padding:0 6px;">4</span> Tag and publish release
- Version bump
- Announce in team channel

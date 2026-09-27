# Token Maxxer — Claude Build Brief

## Your assignment

Act as a product engineer and help me build Token Maxxer. Read this entire brief, inspect the available repository and development environment, produce a concise implementation plan, and begin building the feasible first release. Make routine decisions independently. Ask for clarification only when a missing decision materially blocks progress.

This is a new, independent product. It is **not the typing activity widget** discussed previously. Do not implement typing observation, keyboard monitoring, WPM, or typing metrics.

No implementation stack has been agreed for Token Maxxer. Select and explain a practical stack after inspecting the environment. Do not assume the language discussion for the separate typing app applies here.

## 1. Product concept

Token Maxxer is a public leaderboard for people who consume AI tokens while building things. It combines usage statistics with visible projects so visitors can see both how much AI someone uses and what they are working on.

**Positioning:** Show your usage. Show what you shipped.

This is intentionally a token consumption leaderboard. Different models can consume different amounts of tokens for the same task. We accept that difference; we are not trying to normalize scores into equivalent productivity, task difficulty, or compute effort.

However, the counting rules must be consistent and explicit, and project evidence must not be represented as stronger verification than it really is.

## 2. Decisions already made

- Token Maxxer is independent of the typing app.
- Users can sign in with GitHub or email. GitHub is the primary option; email is an alternative. The exact email authentication method is an implementation choice.
- Avoid requiring users to connect each AI provider separately.
- The preferred flow uses one local collector that detects supported tools and gathers available usage statistics.
- Initial integration candidates are Claude Code and OpenCode. Validate their current capabilities before committing to complete support.
- Projects should be detected automatically from session metadata and working directories where possible.
- Users can approve visibility, rename projects, hide projects, merge duplicates, and optionally add public links.
- Visible project names on the leaderboard become hyperlinks when a user supplies a link.
- Raw model differences are acceptable. Preserve model and token-category breakdowns.
- Private collection and public sharing are separate choices. Nothing becomes public before the user approves it.

## 3. Important constraints

### Identity does not grant usage access

Signing in with an email or GitHub account identifies the person in Token Maxxer. It does not grant access to their Claude, ChatGPT, Zed, OpenCode, or other service accounts, even when the email addresses match.

Do not implement automatic account discovery by matching email addresses. Do not imply that GitHub sign-in unlocks provider usage or private repositories.

### Collection is tool specific

There is no universal token counter that observes every AI application. Each supported source needs a validated connector.

The collector should reduce repeated setup, but some tools may require enabling telemetry or another explicit configuration step. Explain and guide those steps when necessary. Do not promise zero configuration across all tools.

### Missing data is not zero

Unsupported tools, missing token categories, stale collection, and unavailable project attribution must be visible. Do not silently replace unknown values with zero or fabricated estimates.

## 4. Preferred user flow

1. **Sign in** with GitHub or email.
2. **Install and pair one collector** using a short, secure process.
3. **Detect supported tools** and show connection/collection status.
4. **Collect usage locally** through validated connectors.
5. **Detect projects automatically** where session metadata supports attribution.
6. **Review detected projects:** rename, hide, merge duplicates, or add links.
7. **Preview the public profile and leaderboard entry.**
8. **Explicitly publish approved aggregates and projects.**
9. Continue collecting in the background. Approved projects can update under the user's sharing settings; newly detected projects remain private until approved.

Returning users should not need to upload evidence repeatedly. Unsupported tools should not block supported usage from appearing.

## 5. Product surfaces

### Public leaderboard

Default to a weekly leaderboard, with daily and all-time views if practical. Publish the timezone and week boundary used for rankings.

Each row should show:

- Rank.
- Display name, handle, and avatar where available.
- Reported tokens during the selected period.
- Visible project names, linked when URLs are provided.
- A compact evidence/source indicator.

Example with fictional data:

| Rank | Builder | Reported tokens this week | Projects |
| --- | --- | --- | --- |
| 1 | @maya | 24.8M | Budget App ↗ · Portfolio ↗ |
| 2 | @dan | 18.2M | Browser Extension ↗ |

Do not present model token counts as measures of skill or productivity. Explain the headline counting rule near the leaderboard.

### Public builder profile

- Approved aggregate usage over time.
- Tool and model breakdowns.
- Input, output, cache, and other available categories.
- Public project cards with optional descriptions and links.
- Tokens attributed to each project when available.
- Source coverage and verification status.

### Private dashboard

- Recent usage and collector status.
- Detected tools, unsupported states, and setup guidance.
- Detected projects and unassigned usage.
- Project visibility, name, link, and merge controls.
- Public profile preview and publishing controls.
- Data deletion and collector revocation.

### Collector interface

Keep it small: pairing, detected tools, collection status, pause/resume, sharing status, and diagnostics that contain no prompt or code content.

Use a clean, readable UI. Avoid overwhelming the leaderboard with operational details; put explanations in accessible supporting views.

## 6. Automatic project detection

Identify projects using this priority:

1. The tool's session metadata: working directory or project identifier.
2. The Git repository root, when available, to group files and subfolders.
3. The workspace folder for projects without Git.

Individual filenames are not reliable project identifiers. Common names such as `app.ts` and `README.md` should not become separate projects.

Keep the full path locally. Publish only an approved display name and an opaque identifier. A detected folder name may contain a confidential client name or unreleased product, so do not publish it automatically.

Account for repositories with multiple worktrees, nested repositories, monorepos, renamed folders, and duplicate names. Start with a clear default grouping rule and user merge controls. Do not collapse projects solely because their folder names match.

Do not inspect Git remote URLs for publication without clear disclosure, and do not automatically publish those URLs. The initial flow lets users supply links manually.

### Project attribution

The folder identifies the project; session usage records provide its token count. Attribute usage automatically only when the connector exposes a defensible session-to-project relationship.

If that relationship is missing, mark usage **unassigned**. Allow manual assignment and label it as user supplied. If one session touches multiple projects, do not invent an exact split.

The sum of attributed and unassigned usage must reconcile with the user's aggregate usage. Merging, renaming, and hiding projects must not create extra tokens.

### Optional public links

Support a repository, live website, demo, release, or video URL. Validate URLs and render them safely. Adding a link makes the project name clickable; it does not independently verify ownership, completion, or token attribution.

Use labels such as **project detected** and **project linked**. A workspace with AI activity is not necessarily a shipped product.

## 7. Connector strategy

### First candidates

**Claude Code:** Investigate its documented OpenTelemetry token metrics and any supported usage interfaces. Prefer a local metrics collector with content events disabled. Validate project attribution independently; do not assume metrics include a working directory.

**OpenCode:** Investigate its current statistics functionality and supported local usage interfaces. Validate whether records expose token categories, stable identities, timestamps, and session project information. Do not assume an internal database schema is a stable public API.

### Later candidates

- Zed: model access can use provider APIs, Zed-hosted access, or external agents. Assess each supported path independently.
- Direct provider APIs: usage metadata can be collected through an authorized integration, but separate provider connections are not the preferred initial flow.
- ChatGPT and Claude consumer apps: unsupported until a reliable, authorized usage interface is established. Message counts and subscription limits are not exact token counts.
- Other tools: add through a connector interface after validating their data sources.

Document a support matrix for each connector: detection, required setup, token categories, history availability, project attribution, and limitations.

## 8. Token accounting

Create a common internal representation while retaining source semantics:

- Tool, provider, and model when available.
- Source version and connector version.
- Observation time and usage period.
- Stable source event/request/session identity when available.
- Input and output token categories.
- Cache read/write categories when available.
- Reasoning details when available, including whether they are already contained in output.
- Availability flags for missing fields.
- Project attribution and its provenance.
- Evidence source and verification level.

Do not use one naive `input + output + cache + reasoning` formula across every provider. Cached input or reasoning may already be included in another field. The connector must map source categories into mutually exclusive accounting buckets where possible.

The leaderboard may use total reported input and output processing volume, including cache categories according to a documented rule. Validate the exact rule against the first connectors before locking it in. If a category cannot be reconciled, show the limitation rather than guessing.

Preserve category breakdowns even if the leaderboard shows one headline total. No cross-model productivity normalization is required.

### Prevent duplicate counts

- Choose a canonical collection source per integration.
- Do not add provider totals to tool totals covering the same requests.
- Use idempotent ingestion and stable source identifiers when available.
- Distinguish cumulative metric snapshots from incremental usage events.
- Handle collector restarts, replayed history, retries, streaming updates, and counter resets.
- Do not promise reliable cross-source deduplication when identifiers are missing.

## 9. Evidence and leaderboard integrity

Keep these claims separate:

- **Locally reported usage:** received from a user's collector or local records.
- **Provider-verified usage:** confirmed through a validated provider-backed verification mechanism, if implemented later.
- **Project detected:** activity associated with a workspace.
- **Project linked:** user supplied an evidence URL.
- **User-assigned attribution:** user manually associated usage with a project.

A paired collector authenticates the sender; it does not prove local records are untampered. Do not label collector data as provider verified simply because upload authentication succeeds.

The first release is a friendly community leaderboard without prizes. Use transparent labels and basic anomaly detection; do not claim fraud-proof verification. Stronger competitions would require additional verification.

## 10. Privacy and security requirements

- Never collect keyboard events for this product.
- Do not upload prompts, generated content, source code, full paths, raw session logs, credentials, or private repository URLs.
- Prefer dedicated usage metadata interfaces over scanning content-bearing logs.
- If a supported source stores usage alongside content, process only the required fields locally and assess whether that approach fits the privacy promise. Document it accurately.
- Keep new projects private until approved.
- Upload only the metadata necessary for approved statistics and evidence labels.
- Separate raw local identifiers from public display identifiers.
- Use minimal authentication scopes. GitHub login should not request private repository access for public links.
- Store collector credentials securely, authenticate ingestion, and support revocation.
- Scope ingestion and edits to the authenticated user.
- Include pause, deletion, and unpublishing controls.
- Keep diagnostics free of content and secrets.
- Explain retention and distinguish local data, uploaded private data, and published data.

Do not change system settings, enable tool telemetry, inspect personal sessions, upload real usage, or publish/deploy the product without authorization. Prepare the code, setup guidance, and reviewable UI first. Use synthetic fixtures for development unless real-data access is explicitly authorized.

## 11. Architecture expectations

Choose a practical implementation with these boundaries:

1. **Local collector:** connector adapters, local normalization, project detection, durable upload queue, and privacy filtering.
2. **Authenticated backend:** identity, collector pairing, idempotent ingestion, project settings, and deletion.
3. **Ranking layer:** reproducible period aggregates and published counting rules.
4. **Web interface:** public leaderboard, profiles, and private dashboard.

Design stable connector contracts so additional tools can be added without rewriting ranking logic. Use schema migrations and preserve provenance. Keep unknown values distinguishable from zero throughout the API and UI.

## 12. Concrete next steps

### Step 1 — Inspect and validate

- Inspect the repository, existing instructions, installed runtimes, and available build tools.
- Verify current official documentation and source code for Claude Code and OpenCode usage collection.
- Produce a concise capability matrix and proposed stack.
- Identify authentication configuration and any credentials needed later. Do not treat GitHub or email authentication as functioning until actually configured and tested.

### Step 2 — Define contracts

- Define normalized usage records, source identifiers, accounting rules, and project attribution.
- Define pairing, ingestion, project approval, and public profile APIs.
- Define public/private data boundaries and evidence labels.

### Step 3 — Build an end-to-end slice

Use clearly marked synthetic fixtures to implement:

- A leaderboard and public profile.
- A private dashboard with detected projects.
- Rename, hide, merge, optional links, and publish preview.
- Collector-to-backend ingestion and period aggregation.

Simulated data must be visibly labeled and never mistaken for verified user activity.

### Step 4 — Add real connectors

Implement the first validated connector, then the second. Include required setup guidance, status reporting, and project attribution where supported. Handle partial coverage and unassigned usage honestly.

### Step 5 — Verify

Test meaningful risks:

- Category overlap and double counting.
- Replayed events, cumulative snapshots, and collector restarts.
- Project merges and aggregate reconciliation.
- Privacy filtering and newly detected project visibility.
- User authorization, pairing revocation, and idempotent ingestion.
- Ranking boundaries and stale/missing data.

Visually inspect the main screens. Check that an optional link makes the approved project name clickable and that private paths never appear in public responses.

## 13. First-release acceptance criteria

- GitHub and email sign-in work when deployment credentials are configured; unconfigured states are explicit.
- One paired collector can gather usage from at least one validated supported tool, with the second candidate implemented if feasible.
- Users can see connector coverage and required setup.
- Projects are detected when source metadata supports it; otherwise usage remains unassigned.
- Users can rename, hide, merge, and optionally link projects.
- Public sharing requires an explicit review and publish action.
- Leaderboard totals follow one documented accounting rule and do not double count known overlapping fields or replayed records.
- Public project names link to user-supplied URLs when present.
- Evidence labels accurately reflect data provenance.
- Prompts, code, secrets, and full local paths are absent from uploads and public views.
- The interface is usable with empty, partial, offline, stale, and unsupported states.

## 14. Deferred scope

- Universal support for every AI app.
- Automatically accessing accounts through matching email addresses.
- Private repository import.
- Browser scraping or intercepting arbitrary application traffic.
- Exact attribution when a source does not expose it.
- Prizes, fraud-proof rankings, and claims of verified productivity.
- Normalizing different models into equivalent task scores.
- Typing tracking or typing widgets.

## 15. Reference starting points

These were identified during product discussion. Recheck them before implementation; capabilities and schemas can change.

- Claude Code monitoring: https://code.claude.com/docs/en/monitoring-usage
- OpenCode statistics source: https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/cli/cmd/stats.ts
- Zed API access paths: https://zed.dev/docs/ai/use-api-access
- OpenAI token concepts: https://help.openai.com/en/articles/4936856-understanding-and-counting-tokens

## Final delivery expectations

Deliver a runnable implementation, setup documentation, connector support matrix, accounting definitions, and a concise summary of what was verified. Clearly identify unavailable integrations, unconfigured authentication, required user setup, and any remaining platform-specific checks.

Start building after the initial inspection and feasibility assessment. Do not stop at a product proposal when implementation can proceed. If credentials block live authentication or a connector cannot yet be validated, continue independent implementation with clearly labeled fixtures and document the remaining dependency.

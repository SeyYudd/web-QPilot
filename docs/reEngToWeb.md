# SIT Web Generator: Re-Engineering Architecture and Specification

> Status: target architecture plus current implementation boundary. The active UI branding is QPilot; the repository package name remains `sit-web-generator`.

## 1. Purpose and Scope

This document specifies the migration of the desktop/extension-based automated test capture tool into a client-only web application. The web application captures test evidence, allows image annotation, stores work locally, and synchronizes explicitly selected data with Jira and Confluence.

The product is a static React application. It has no custom backend, application database, server session, proxy, telemetry endpoint, or server-side job. Jira and Confluence are the only remote systems contacted by the application.

### Goals

- Capture or import screenshots and associate them with test cases.
- Create and edit test suites and structured test steps locally.
- Annotate screenshots on an image canvas.
- Fetch Jira issues and update test status through Jira REST API v3.
- Upload screenshot attachments to Jira when explicitly requested.
- Export test documentation to Confluence pages through Confluence REST API v2.
- Remain usable offline for local capture, editing, and drafting.

### Non-goals

- Server-side credential storage or token exchange.
- Automatic background synchronization.
- Reading or manipulating arbitrary pages or tabs in the user's browser.
- Treating local browser storage as a secure credential vault.

## 2. Architecture

```text
                         +----------------------+
                         | Static HTTPS hosting |
                         | HTML, JS, CSS, assets |
                         +----------+-----------+
                                    |
                         serves application only
                                    v
+----------------------------------------------------------------+
| User browser                                                   |
|                                                                |
| React + Vite                                                   |
|   |                                                            |
|   +--> localStorage: PAT configuration and preferences         |
|   +--> IndexedDB/Dexie: suites, steps, annotations, screenshots|
|   +--> Jira REST API v3 (direct fetch)                         |
|   +--> Confluence REST API v2 (direct fetch)                   |
+----------------------------------------------------------------+
```

### Technology choices

| Area | Technology | Responsibility |
| --- | --- | --- |
| Application | React 19 + TypeScript | UI, interaction, view state |
| Build/runtime | Vite | Static SPA development and build |
| Styling | Tailwind CSS | Responsive layout and design tokens |
| UI primitives | Shadcn UI | Accessible, composable controls |
| Local binary/data storage | Dexie.js over IndexedDB | Screenshots and structured test data |
| Small settings storage | `localStorage` | Credentials and preferences |
| Remote requests | Browser `fetch` | Jira and Confluence calls |
| Notifications | Sonner | Success, failure, and progress feedback |
| Icons | Lucide React | Consistent accessible iconography |

The application must be deployed over HTTPS. Direct browser calls require the Jira and Confluence installations to permit the deployed origin through CORS. CORS failures cannot be fixed in a client-only application by adding a frontend header.

### Suggested source boundaries

```text
src/
  app/                  # routing, providers, application state
  components/
    auth/               # PAT setup and connection status
    capture/            # capture intake and queue
    editor/             # canvas editor and toolbar
    export/             # export modal and preview
    ui/                 # Shadcn components
  domain/
    capture/            # capture validation and ordering
    editor/             # canvas model, commands, rendering
    jira/               # Jira types and operations
    confluence/         # Confluence types and operations
    templates/          # documentation serialization
  infrastructure/
    api/                # auth headers, fetch client, errors
    storage/            # localStorage repositories and Dexie database
```

React components orchestrate domain and infrastructure modules. API calls, IndexedDB transactions, image geometry, and Confluence HTML generation should not be embedded in presentational components.

## 3. Credential and Preference Storage

### 3.1 Storage policy

Credentials are stored in `localStorage` only when the user explicitly enables **Remember credentials**. With that option disabled, tokens remain in memory for the current browser session and are cleared on refresh, tab close, or sign out.

`localStorage` is appropriate for small values only. Screenshots, canvas state, and test suites must not be serialized into it.

### 3.2 Keys

```ts
export const STORAGE_KEYS = {
  credentials: "sit-web.credentials.v1",
  preferences: "sit-web.preferences.v1",
} as const;
```

### 3.3 PAT schema

```ts
export type AuthScheme = "basic" | "bearer";

export type ServiceCredentials = {
  baseUrl: string;       // normalized origin/base path, no trailing slash
  email: string;
  pat: string;
  authScheme: AuthScheme;
  connectedAt?: string;  // ISO-8601 timestamp
};

export type StoredCredentials = {
  version: 1;
  remember: boolean;
  jira: ServiceCredentials;
  confluence: ServiceCredentials;
};
```

Example:

```json
{
  "version": 1,
  "remember": true,
  "jira": {
    "baseUrl": "https://jira.example.com",
    "email": "qa@example.com",
    "pat": "user-supplied-jira-pat",
    "authScheme": "basic",
    "connectedAt": "2026-09-02T10:00:00.000Z"
  },
  "confluence": {
    "baseUrl": "https://confluence.example.com",
    "email": "qa@example.com",
    "pat": "user-supplied-confluence-pat",
    "authScheme": "bearer"
  }
}
```

The exact authentication scheme is deployment-specific. Basic authentication sends `email:PAT` encoded as Base64. Bearer authentication sends the PAT as a Bearer token. Never send both schemes, and never infer the scheme from token text.

### 3.4 Preference schema

```ts
export type StoredPreferences = {
  version: 1;
  theme: "light" | "dark" | "system";
  defaultImageFormat: "png" | "jpeg" | "webp";
  jpegQuality: number;
  retentionDays: 7 | 30 | 90 | null; // null means manual cleanup
};
```

## 4. IndexedDB and Dexie Data Model

### 4.1 Database definition

Database name: `sit-web-generator`. Database version starts at `1` and must be incremented for future migrations.

```ts
import Dexie, { type EntityTable } from "dexie";

export type TestSuite = {
  id?: string;
  name: string;
  description?: string;
  projectKey?: string;
  jiraIssueKey?: string;
  createdAt: number;
  updatedAt: number;
};

export type TestStep = {
  id?: string;
  suiteId: string;
  position: number;
  action: string;
  testData?: string;
  expectedResult: string;
  status: "not-run" | "passed" | "failed" | "blocked";
};

export type CanvasAnnotation = {
  id: string;
  type: "arrow" | "rectangle" | "ellipse" | "line" | "freehand" | "text" | "blur";
  points?: Array<{ x: number; y: number }>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
  fontSize?: number;
  blurRadius?: number;
};

export type Screenshot = {
  id?: string;
  suiteId?: string;
  stepId?: string;
  originalBlob: Blob;
  editedBlob?: Blob;
  mimeType: string;
  filename?: string;
  source: "upload" | "paste" | "screen-capture";
  annotations: CanvasAnnotation[];
  width: number;
  height: number;
  position: number;
  createdAt: number;
  updatedAt: number;
};

export const db = new Dexie("sit-web-generator") as Dexie & {
  suites: EntityTable<TestSuite, "id">;
  steps: EntityTable<TestStep, "id">;
  screenshots: EntityTable<Screenshot, "id">;
};

db.version(1).stores({
  suites: "id, name, projectKey, jiraIssueKey, updatedAt",
  steps: "id, suiteId, [suiteId+position], status",
  screenshots: "id, suiteId, stepId, [suiteId+position], createdAt, updatedAt",
});
```

### 4.2 Entity rules

- IDs are generated with `crypto.randomUUID()` and are stable across edits.
- `position` is the display order within a suite or step.
- Screenshots store binary `Blob` values directly in IndexedDB, not Base64 strings.
- `editedBlob` is optional; when absent, the original is the current export source.
- Annotation coordinates use natural image pixels, independent of displayed canvas size.
- Saving a screenshot and its metadata is one Dexie transaction.
- Deleting a suite must delete its steps and screenshots in a transaction.
- The UI must provide storage usage, quota warnings, retention cleanup, and orphan cleanup.

## 5. API Integration Specification

### 5.1 Shared request behavior

All API requests:

- Use the normalized configured base URL.
- Set `Accept: application/json`.
- Set `Authorization` only for direct Jira/Confluence requests.
- Use `credentials: "omit"` unless the target deployment explicitly requires otherwise.
- Never include tokens in query strings, URL fragments, logs, error objects, or analytics.
- Normalize non-2xx responses into safe errors containing service, operation, status, and a user-actionable message.

The client must distinguish invalid URL, CORS/network failure, HTTP 401, HTTP 403, HTTP 404, HTTP 409, rate limit, and server errors.

### 5.2 Jira REST API v3

Base path: `{jiraBaseUrl}/rest/api/3`.

| Operation | Method and path | Purpose |
| --- | --- | --- |
| Validate credentials | `GET /myself` | Confirm identity and connection |
| Fetch issues | `GET /search/jql` or deployment-supported search endpoint | Load issues by project, key, or JQL |
| Fetch issue | `GET /issue/{issueKey}` | Load summary, status, fields, and metadata |
| Update test status | `PUT /issue/{issueKey}` | Update configured status field or fields |
| Transition issue | `POST /issue/{issueKey}/transitions` | Move issue through a Jira workflow |
| Upload screenshot | `POST /issue/{issueKey}/attachments` | Attach a screenshot directly to Jira |

Attachment requests use `multipart/form-data` with the browser-generated `FormData`. Do not manually set the multipart boundary. Jira attachment endpoints commonly require `X-Atlassian-Token: no-check`; this header must be documented and limited to that request.

Jira status mapping must be configurable because workflows differ. A local result such as `passed` may map to a transition ID or a configured custom field. The UI must show the target issue and proposed change before updating.

### 5.3 Confluence REST API v2

Base path: `{confluenceBaseUrl}/wiki/api/v2` for Atlassian Cloud-style deployments. The deployment's documented base path must be configurable for Server/Data Center installations.

| Operation | Method and path | Purpose |
| --- | --- | --- |
| Validate credentials | Deployment-supported current-user endpoint | Confirm identity and connection |
| Find pages | `GET /pages?space-id=...&title=...` | Select an export target |
| Read page | `GET /pages/{id}?body-format=storage&version=...` | Obtain current body and version |
| Create page | `POST /pages` | Create a new documentation page |
| Update page | `PUT /pages/{id}` | Replace body and increment version |

Confluence v2 page bodies should use the deployment-supported storage representation. The exporter must produce valid Confluence storage HTML, escape all user-controlled text, validate links, and show a preview before mutation.

Page updates must use optimistic concurrency. Read the current version, increment it for the update, and on HTTP 409 re-fetch the page and ask the user to review/retry rather than silently overwriting changes.

## 6. UI and User Flow

### Current QPilot dashboard

The authenticated dashboard uses a light blue QPilot shell with a collapsible sidebar. It contains Create TMP/ISO, Create SIT Page, Check & Sync TE, Upload Capture, and Import Test Case. Create SIT Page is active by default; the other four currently render placeholder views.

### 6.1 Login / PAT Setup

Initial route: `#/setup` when no usable credentials exist. Authenticated sessions use `#/workspace`; editor links use `#/editor/:screenshotId`. The settings action may still open the existing in-session setup dialog.

The form contains separate Jira and Confluence sections:

1. Atlassian base URL.
2. User email or username.
3. PAT input with show/hide control.
4. Authentication scheme.
5. **Test connection** action.
6. **Remember credentials** checkbox with a security warning.

Successful connection displays the Atlassian identity and timestamp. Jira and Confluence states are independent: a failed Confluence test must not invalidate a successful Jira connection. The user may enter the workspace with only the integration needed for the current task.

Use Shadcn `Dialog`, `Card`, `Input`, `Button`, `Badge`, `Tooltip`, and `Sonner`. Labels, focus management, keyboard navigation, and screen-reader status announcements are required.

### 6.2 Capture Workspace

The workspace is the primary local authoring view.

- Left/sidebar area: test suites, search, create/rename/delete suite.
- Main area: selected suite, steps, status badges, and screenshot queue.
- Actions: upload file, paste from clipboard, drag/drop, optional screen capture, reorder, replace, delete, open editor.
- Each capture shows thumbnail, filename, MIME type, dimensions, size, source, timestamp, and linked suite/step.
- New captures persist immediately to Dexie.
- Unsupported formats, cancelled screen capture, and quota errors produce actionable notifications.

Screen capture uses `navigator.mediaDevices.getDisplayMedia` only after an explicit user gesture and must stop all tracks after the screenshot is taken. If unavailable, upload, paste, and drag/drop remain available.

### 6.3 Image Canvas Editor

Opening a screenshot navigates to `/editor/:screenshotId` or opens a full-screen editor.

Editor layout:

- Canvas viewport with fit-to-screen image rendering.
- Toolbar for select, crop, rotate, flip, pen, text, rectangle, ellipse, line, arrow, blur, pixelation, undo, redo, reset, save, and export.
- Properties panel for color, stroke width, fill, font size, and blur strength.
- Save writes annotations and an edited Blob to IndexedDB.
- Export downloads PNG, JPEG, or WebP using `URL.createObjectURL`; every object URL is revoked after use.

Pointer coordinates are converted from CSS pixels to natural image pixels. Pointer capture keeps drawing active outside the canvas. History entries are immutable and bounded to prevent unbounded memory use. Pointer moves update in memory; only intentional save/checkpoint operations write to IndexedDB.

On narrow screens the toolbar becomes a horizontally scrollable strip or bottom sheet. No essential action may depend on hover.

### 6.4 Jira / Confluence Export Modal

The export action opens a Shadcn `Dialog` containing `Tabs` for Jira and Confluence.

Common controls:

- Selected suite and screenshots.
- Preview of the generated content.
- Explicit confirmation before any remote write.
- Progress, per-item result, retry, and failure details.

Jira tab:

- Search/select an issue.
- Preview status update and attachment list.
- Choose status mapping/transition.
- Update status and upload screenshots as separate explicit actions.

Confluence tab:

- Select space and target page, or choose create page.
- Enter page title.
- Select `expand` or `table` layout.
- Preview sanitized/generated storage HTML.
- Create or update the page only after confirmation.

Remote operations are never triggered by merely opening the modal or generating a preview.

The Create SIT Page module also contains local Space Key Confluence, Parent Page ID, Jira Test Execution Key, and SIT PAGE NAME inputs. Its load and generate controls are currently prototype actions; the existing remote operations are exposed through the export dialog.

## 7. Confluence Documentation Format

The serializer accepts typed domain data and returns deterministic storage-format HTML.

The generated document should include:

- Suite title and description.
- Jira issue reference, when present.
- Test steps table with action, test data, expected result, and status.
- Screenshot evidence using supported Confluence image/attachment markup.
- Optional expand macros for compact evidence sections.

Required serialization rules:

- Escape `&`, `<`, `>`, `"`, and `'` in user text.
- Convert line breaks according to the selected template.
- Validate Jira keys and external URLs before rendering links.
- Never interpolate raw user HTML or PAT values.
- Preview through a sanitized/sandboxed surface; do not execute generated markup.

## 8. Security and Privacy

### 8.1 PAT risks

`localStorage` is readable by any JavaScript executing in the same origin. Browser storage is not encrypted by this architecture. A cross-site scripting vulnerability, malicious dependency, browser extension, compromised browser profile, managed-device software, browser backup, or local malware may expose PATs.

The application must state this limitation clearly during setup. Users should use narrowly scoped, revocable tokens and avoid storing credentials on shared or unmanaged devices.

### 8.2 Required controls

- Serve only over HTTPS.
- Apply a strict Content Security Policy, including a restricted `connect-src` allowlist for configured Atlassian hosts where operationally possible.
- Audit dependencies and pin lockfile versions.
- Do not use third-party analytics or error reporting that can receive credentials or screenshots.
- Redact `Authorization`, request bodies, screenshots, page bodies, and PAT-shaped strings from logs.
- Do not place credentials in URLs, route state, clipboard data, or DOM attributes.
- Use `credentials: "omit"` for token-authenticated requests unless required otherwise.
- Validate base URLs and reject unsafe schemes such as `javascript:` and `data:`.
- Sanitize preview content and escape all Confluence output values.
- Provide **Sign out**, **Clear credentials**, and **Clear all local data** actions.
- Clear in-memory tokens on sign out and revoke all object URLs.
- Require confirmation before Jira attachments, Confluence updates, and destructive local deletion.
- Use same-origin deployment and avoid embedding the app in an untrusted iframe.

### 8.3 Data boundaries

| Data | Local browser | Jira | Confluence | App-owned server |
| --- | --- | --- | --- | --- |
| PATs | Optional `localStorage` | Authorization header only | Authorization header only | Never |
| Draft suites/steps | IndexedDB | Only on explicit update | Only on explicit export | Never |
| Original screenshots | IndexedDB | Only explicit attachment | Only explicit attachment/page export | Never |
| Edited screenshots | IndexedDB | Only explicit attachment | Only explicit export | Never |

## 9. Error Handling and UX States

Every network operation has idle, loading, success, and failure states. Errors must identify the operation and next action without exposing secrets.

- 401: token invalid, expired, or wrong authentication scheme.
- 403: authenticated user lacks the required Jira/Confluence permission.
- 404: wrong base path, issue, page, project, or space.
- 409: remote resource changed; re-fetch and request confirmation.
- 413/quota: attachment or browser storage limit exceeded.
- CORS/network: verify HTTPS, origin allowlist, and service availability.
- Offline: retain local work and disable remote actions with an offline indicator.

Use `Sonner` for transient feedback and persistent inline errors for failures that require user decisions.

## 10. Testing and Acceptance Criteria

### Unit tests

- Credential schema validation and URL normalization.
- Basic and Bearer authorization header generation.
- Jira response/status mapping.
- Confluence HTML escaping and deterministic serialization.
- Canvas coordinate conversion, crop geometry, transforms, and history.
- Dexie transaction behavior and orphan cleanup.

### Component tests

- PAT setup validation and token show/hide behavior.
- Independent Jira and Confluence connection states.
- Capture queue add, reorder, replace, delete, and persistence.
- Canvas annotation, undo/redo, save, and export.
- Export modal preview, confirmation, progress, and error states.

### Browser tests

- First-run setup, refresh with remembered credentials, and sign out.
- Upload/edit/save/download workflow.
- Jira issue lookup, status update, and attachment upload using mocked APIs.
- Confluence page creation/update and HTTP 409 conflict handling.
- Offline mode, IndexedDB failure, and storage quota behavior.

### Release acceptance

- `npm run build` succeeds.
- `npm run lint` succeeds.
- No PAT or screenshot appears in application logs, URLs, telemetry, or non-Atlassian requests.
- Keyboard-only and mobile workflows are usable.
- Production-origin CORS behavior has been tested against the supported Jira and Confluence deployment types.
- Privacy notice explains that credentials and drafts remain in the browser and that explicit exports send data directly to Atlassian.

## 11. Delivery Sequence

1. Establish Vite routes, Tailwind tokens, Shadcn shell, theme, and error boundary.
2. Implement credential repositories, PAT setup, connection tests, and safe API client.
3. Implement Dexie schema, repositories, migrations, storage indicator, and cleanup.
4. Build capture workspace with upload, paste, screen capture, and queue management.
5. Extract canvas model/engine and build the responsive image editor.
6. Add Jira issue lookup, status mapping, and explicit attachment upload.
7. Add Confluence page selection, serializer, preview, create/update, and conflict handling.
8. Complete automated tests, accessibility review, security review, and production-origin integration testing.

The resulting deployment is a static web application. Hosting serves the application bundle only; it does not receive or retain credentials, test data, screenshots, or generated documentation.

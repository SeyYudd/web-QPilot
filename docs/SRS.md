# Software Requirements Specification (SRS)

> Implementation status: the current SPA provides the authenticated shell, PAT session management, and working Jira/Confluence integrations for all five modules (Create SIT Page, Create TMP/ISO, Check & Sync TE, Upload Capture, Import Test Case) via a same-origin dev proxy. Local capture/editor flow and Atlassian publishing are implemented end-to-end.

## 1. System Architecture & Tech Stack

### 1.1 Architecture

The system shall be a client-side-only single-page application. It shall not require a custom backend, application database, server session, proxy, telemetry endpoint, or background job.

The browser communicates with Jira and Confluence through a same-origin dev proxy (`/api/jira-proxy` → `https://jira.bri.co.id`, `/api/confluence-proxy` → `https://confluence.bri.co.id`) configured in `vite.config.ts`. The proxy rewrites the path prefix, strips `Cookie`/`Cookie2`, and rewrites `Origin`/`Referer` to the target domain to satisfy the Data Center XSRF gate. All client `fetch` calls are centralized in `apiFetch` (`src/lib/auth/session.ts`), which rewrites absolute BRI host URLs to the proxy prefixes (`toProxyUrl`), sends PAT bearer auth, `credentials: "omit"`, `X-Atlassian-Token: no-check`, and `X-Requested-With: XMLHttpRequest` for Confluence mutations. The application remains functional for local authoring when those services are unavailable.

Current route handling uses hash navigation (`#/setup`, `#/workspace`, and `#/editor/:screenshotId`) and lightweight React state rather than React Router.

### 1.2 Technology stack

| Concern | Requirement |
| --- | --- |
| UI runtime | React 18+; project baseline React 19 with TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Components | Shadcn UI and Radix primitives |
| Local database | Dexie.js over IndexedDB |
| Small settings | Browser `localStorage` |
| Notifications | Sonner |
| Icons | Lucide React |
| Network | Typed browser `fetch` clients |
| Tests | Unit, component, and browser tests using the project test tooling |

React components shall orchestrate domain and infrastructure modules. API calls, storage transactions, canvas geometry, and HTML serialization shall remain independently testable.

## 2. Functional Requirements

### FR-1: Auth & LocalStorage PAT Management (implemented)

1. The system provides a single PAT setup form accepting the user's PN (employee number), display name, Jira PAT, and Confluence PAT.
2. The system validates each PAT independently and silently at startup: Jira via `GET /rest/api/2/myself`, Confluence via `GET /rest/api/user/current`.
3. Validated sessions are persisted as a versioned JSON record under the `qpilot_auth_session` localStorage key (`pn`, `displayName`, `jiraPat`, `confluencePat`, `lastValidated`).
4. Network failures are classified as `NETWORK_OFFLINE`, `CORS_BLOCKED`, `TOKEN_EXPIRED`, or `SESSION_CORRUPTED` through the typed `AuthError` class, each with user-facing Indonesian messaging.
5. At runtime, any HTTP 401 from Jira/Confluence triggers auto-eviction: the session is cleared and the UI returns to the setup state (`TOKEN_EXPIRED`).
6. Protected routes redirect unauthenticated users to the setup flow (`ProtectedRoute`).
7. The system does not expose PATs in URLs, logs, errors, telemetry, or non-Atlassian requests.

### FR-2: Capture & Step Builder Workspace

1. The system shall allow users to create, rename, search, select, and delete test suites.
2. The system shall allow users to create, edit, reorder, and delete test steps.
3. Each step shall contain action, optional test data, expected result, and status.
4. The system shall accept screenshots through file upload, drag/drop, clipboard paste, and optional `getDisplayMedia` capture.
5. The system shall associate captures with suites and optionally with steps.
6. The system shall display capture thumbnail, filename, MIME type, dimensions, size, source, timestamp, and order.
7. The system shall support reorder, replace, delete, and open-in-editor actions.
8. New captures shall persist to IndexedDB immediately.
9. The system shall report unsupported format, cancelled capture, and quota errors.
10. Screen-capture media tracks shall be stopped after capture.

### FR-3: Canvas Image Editor

1. The system shall open a screenshot by ID in a responsive editor.
2. The editor shall support select, crop, rotate, horizontal flip, vertical flip, freehand strokes, text, rectangle, ellipse, line, arrow, blur, and pixelation.
3. The editor shall support configurable color, stroke width, fill mode, font size, and blur strength.
4. The editor shall support immutable bounded undo/redo history.
5. The editor shall convert displayed CSS coordinates to natural image-pixel coordinates.
6. The editor shall use pointer capture during drawing.
7. Save shall persist annotations and the edited image Blob in one transaction.
8. Export shall support PNG, JPEG, and WebP downloads.
9. Object URLs shall be revoked after preview or download use.
10. Essential controls shall remain usable on mobile without hover.

### FR-4: Dexie IndexedDB Offline Persistence

1. The database shall be named `sit-web-generator`.
2. The database shall use versioned Dexie migrations beginning at version 1.
3. The system shall store suites, steps, screenshots, and annotations in IndexedDB.
4. Screenshot binary content shall be stored as Blob values, not Base64 strings.
5. IDs shall be stable UUIDs generated with `crypto.randomUUID()`.
6. Screenshot metadata and binary content shall be saved transactionally.
7. Deleting a suite shall delete dependent steps and screenshots transactionally.
8. The system shall provide storage usage, quota warning, retention cleanup, and orphan cleanup.
9. Local authoring shall continue when remote services are unavailable.

### FR-5: Jira REST API Direct Integration (implemented, API v2)

1. The system calls Jira through the proxy at `/api/jira-proxy/rest/api/2`.
2. It validates credentials with `GET /myself`.
3. Import Test Case creates Xray Test issues via `POST /rest/api/2/issue` with degraded-payload fallback (steps → no-steps → base fields) when Jira rejects optional fields.
4. It registers created tests into the Xray Test Repository folder (`/rest/raven/1.0/api/testrepository/{project}/folders`) and adds them to a Test Execution.
5. It supports issue linking (`Relates`) and issue lookup for Check & Sync TE.
6. Non-OK responses are logged to the console with the full response body (`[Jira API] Rejected`) and surfaced to the UI with Jira's `errorMessages`/`errors` detail.
7. Empty/204 response bodies are parsed safely (`safeParseJson`) so update/assign flows never crash on `Unexpected end of JSON input`.
8. The system handles 401 (auto-eviction), 403 (detailed report), 404, 409, network errors, and CORS errors safely.

### FR-6: Confluence Export (implemented)

1. The system calls Confluence through the proxy at `/api/confluence-proxy/rest/api`.
2. It validates credentials with `GET /rest/api/user/current`.
3. Create SIT Page loads test cases from a Jira Test Execution and publishes the SIT page via `POST /rest/api/content` under the configured parent page.
4. Confluence mutations send `X-Atlassian-Token: no-check` and `X-Requested-With: XMLHttpRequest` (Data Center AJAX requirement).
5. Non-OK responses are logged with full body (`[Confluence API] Rejected`) and surfaced with `message`/`errorMessages`/`errors` detail.
6. Empty/204 bodies are parsed safely (`safeParseJson`).

### Current implementation notes

- The authenticated dashboard is branded QPilot and defaults to **Create SIT Page**.
- Create SIT Page collects Space Key, Parent Page ID, Jira Test Execution Key, and SIT Page Name; `Load Test Cases` fetches from Jira and `Generate SIT PAGE` publishes to Confluence.
- Check & Sync TE, Upload Capture, and Import Test Case are wired to Jira/Confluence through the shared clients (`createJiraClient`, `createConfluenceClient`, `requestApi`, `jiraImport.api`), with extension-client fallback (`window.qpilotApiFetch`) preserved.
- SIT page body HTML assembly (`window.QPilotSitTemplateBuilder`) is currently provided by the extension; in web-app mode the page is created with empty body content until a web-side builder is implemented.
- A latent issue remains in Check & Sync TE: Confluence reads go through `createJiraClient`, sending the Jira PAT instead of the Confluence PAT.

## 3. Non-Functional Requirements

### Performance

- The initial application shell shall be statically cacheable and shall not wait for Atlassian connectivity.
- Local suite and step operations shall feel immediate for normal browser storage volumes.
- Canvas pointer movement shall update in memory without writing every event to IndexedDB.
- Large image operations shall avoid unnecessary Base64 duplication.
- The system shall warn before browser quota exhaustion where `navigator.storage.estimate()` is available.

### Data security and PAT protection

- Production shall use HTTPS.
- PATs shall be optional in `localStorage`, with an in-memory default.
- Browser `localStorage` shall be documented as readable by same-origin JavaScript and not equivalent to encrypted storage.
- Tokens shall be narrowly scoped and revocable according to organizational policy.
- Authorization headers, PATs, screenshots, page bodies, and generated HTML shall not be logged or sent to third parties.
- A strict CSP, dependency audit, input validation, output escaping, and sanitized previews are required.

### Browser storage and reliability

- IndexedDB unavailability shall produce a clear message and permit in-memory/local download operation where possible.
- Quota failures shall preserve existing data and explain cleanup options.
- Local data shall be origin-scoped and shall not be assumed to sync between deployments or browsers.
- Schema changes shall use explicit Dexie migrations.

### Usability and accessibility

- The application shall support desktop and mobile viewport sizes.
- Keyboard users shall be able to complete setup, capture, edit, and export workflows.
- Inputs shall have labels; icon-only controls shall have accessible names or tooltips.
- Dialogs shall manage focus and announce loading/success/error states.
- Destructive actions and remote writes shall require confirmation.
- No essential operation shall rely on hover.

## 4. Data Models & Schemas

### 4.1 LocalStorage session (current implementation)

Key: `qpilot_auth_session`.

```ts
type AuthSession = {
  pn: string;            // employee number, e.g. "90188896"
  displayName: string;
  jiraPat: string;       // Bearer PAT for Jira Data Center
  confluencePat: string; // Bearer PAT for Confluence Data Center
  lastValidated: string; // ISO date of last successful validation
};
```

Failure kinds (`AuthError`): `NETWORK_OFFLINE`, `CORS_BLOCKED`, `TOKEN_EXPIRED`, `SESSION_CORRUPTED`.

### 4.2 LocalStorage preferences

Key: `sit-web.preferences.v1`.

```ts
type StoredPreferences = {
  version: 1;
  theme: "light" | "dark" | "system";
  defaultImageFormat: "png" | "jpeg" | "webp";
  jpegQuality: number;
  retentionDays: 7 | 30 | 90 | null;
};
```

### 4.3 Dexie tables

| Table | Primary key | Required indexes | Main data |
| --- | --- | --- | --- |
| `suites` | `id` | `name`, `projectKey`, `jiraIssueKey`, `updatedAt` | Suite name, description, Jira link, timestamps |
| `steps` | `id` | `suiteId`, `[suiteId+position]`, `status` | Action, data, expected result, status |
| `screenshots` | `id` | `suiteId`, `stepId`, `[suiteId+position]`, `createdAt`, `updatedAt` | Blobs, metadata, annotations, dimensions |

```ts
type TestSuite = {
  id?: string;
  name: string;
  description?: string;
  projectKey?: string;
  jiraIssueKey?: string;
  createdAt: number;
  updatedAt: number;
};

type TestStep = {
  id?: string;
  suiteId: string;
  position: number;
  action: string;
  testData?: string;
  expectedResult: string;
  status: "not-run" | "passed" | "failed" | "blocked";
};

type CanvasAnnotation = {
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

type Screenshot = {
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
```

## 5. Interface & UX Specifications

### 5.1 Route mappings

| Route | View | Behavior |
| --- | --- | --- |
| `#/setup` | Standalone PAT setup page | Required when no usable credentials exist |
| `#/workspace` or empty hash | Authenticated QPilot dashboard | Sidebar and selected module |
| `#/editor/:screenshotId` | Image editor | Edit and save one screenshot |
| Modal state | Export dialog | Jira and Confluence tabs |

The current implementation uses `window.location.hash`; React Router is not currently installed. Any future router migration must preserve the protected setup/workspace/editor behavior.

### 5.2 Shadcn UI components

The implementation shall use Shadcn UI for `Button`, `Card`, `Dialog`, `Input`, `Table`, `Tabs`, `Sonner`, `Badge`, `ScrollArea`, and `Tooltip`. Additional `Label`, `Alert`, `Progress`, and confirmation dialog primitives may be used where required.

### 5.3 Dialog and modal behavior

- Dialogs shall trap focus and return focus to the trigger.
- Escape and explicit cancel shall close dialogs without remote side effects.
- Opening an export dialog shall not perform a network write.
- Preview actions shall be read-only.
- Remote writes shall display target, operation, selected artifacts, and confirmation.
- Loading states shall disable duplicate submissions while preserving cancellation where supported.
- Errors shall remain visible inline and may also use Sonner notifications.

### 5.4 Acceptance test summary

- Setup persists only when opted in and never leaks the PAT.
- Capture data survives refresh and remains usable offline.
- Canvas edits preserve natural-coordinate annotations and support undo/redo.
- Jira and Confluence actions are explicit, correctly authenticated, and safely reported.
- CORS, permission, conflict, quota, and offline states are understandable to users.

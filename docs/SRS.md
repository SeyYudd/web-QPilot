# Software Requirements Specification (SRS)

> Implementation status: the current SPA provides the authenticated shell, QPilot sidebar, Create SIT Page UI, local capture/editor flow, and separate Atlassian export dialog. Items marked as planned or partial are not yet complete end-to-end.

## 1. System Architecture & Tech Stack

### 1.1 Architecture

The system shall be a client-side-only single-page application. It shall not require a custom backend, application database, server session, proxy, telemetry endpoint, or background job.

The browser shall communicate directly with Jira and Confluence using `fetch`. The application shall remain functional for local authoring and editing when those services are unavailable.

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

### FR-1: Auth & LocalStorage PAT Management

1. The system shall provide separate Jira and Confluence credential forms.
2. Each form shall accept base URL, email/username, PAT, and `basic` or `bearer` authentication scheme.
3. The system shall normalize URLs by trimming whitespace and removing trailing slashes.
4. The system shall test each service independently before marking it connected.
5. The system shall provide a password-style PAT input with show/hide control.
6. The system shall keep PATs in memory unless **Remember credentials** is enabled.
7. When enabled, the system shall persist a versioned credential record under `sit-web.credentials.v1`.
8. The system shall clear in-memory credentials on sign out and redirect to `#/setup`.
9. The system shall provide clear credentials and clear all local data actions with confirmation.
10. The system shall not expose PATs in URLs, logs, errors, telemetry, or non-Atlassian requests.

Connection tests shall use the configured service's documented current-user endpoint. Jira shall use `GET /rest/api/3/myself`; Confluence shall use the deployment-supported current-user endpoint.

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

### FR-5: Jira REST API Direct Integration

1. The system shall call Jira directly at `{jiraBaseUrl}/rest/api/3`.
2. It shall validate credentials with `GET /myself`.
3. It shall search/fetch issues and display issue key, summary, status, and relevant fields.
4. It shall allow a user to select a target issue before remote modification.
5. It shall preview and explicitly confirm a status update or workflow transition.
6. It shall support configurable local-result-to-Jira-status/transition mapping.
7. It shall upload selected screenshot Blobs through `POST /issue/{issueKey}/attachments`.
8. Attachment upload shall use browser-generated `FormData` and shall not manually set multipart boundaries.
9. Status update and attachment upload shall be separate explicit actions.
10. The system shall handle 401, 403, 404, 409, rate limits, server errors, network errors, and CORS errors safely.

### FR-6: Confluence Export

1. The system shall call Confluence directly at the configured v2 base path.
2. It shall allow selection of a space and existing page or creation of a new page.
3. It shall generate deterministic Confluence storage-format HTML from typed suite data.
4. It shall include suite information, Jira reference when available, test steps, statuses, and screenshot evidence.
5. It shall support `expand` and `table` layouts.
6. It shall escape all user-controlled text and validate links and Jira keys.
7. It shall provide a sanitized or sandboxed preview before mutation.
8. It shall create pages only after explicit confirmation.
9. It shall read the current page version before updating.
10. It shall increment the version and handle HTTP 409 by re-fetching and requesting user review/retry.
11. Preview generation shall never upload attachments or update pages.

### Current implementation notes

- The authenticated dashboard is branded QPilot and defaults to **Create SIT Page**.
- Create TMP/ISO, Check & Sync TE, Upload Capture, and Import Test Case currently render placeholder views.
- Create SIT Page currently collects Space Key, Parent Page ID, Jira Test Execution Key, and SIT Page Name.
- Its preview renders local suite steps and an empty-state test-case table.
- `Load Test Cases` currently shows a local notification rather than loading Jira data.
- `Generate SIT PAGE` is currently a presentation control and does not yet call Confluence.
- The separate export dialog contains the current Jira status/attachment and Confluence page-create operations.

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

### 4.1 LocalStorage credentials

```ts
type AuthScheme = "basic" | "bearer";

type ServiceCredentials = {
  baseUrl: string;
  email: string;
  pat: string;
  authScheme: AuthScheme;
  connectedAt?: string;
};

type StoredCredentials = {
  version: 1;
  remember: boolean;
  jira: ServiceCredentials;
  confluence: ServiceCredentials;
};
```

Key: `sit-web.credentials.v1`.

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

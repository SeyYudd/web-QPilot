# Engineering Team Skills Matrix & Tech Requirements

> Current implementation note: the UI is organized around shared primitives in `src/components/ui` and feature boundaries in `src/components/features/<kebab-case-module-name>`. Networking is centralized in `src/lib/auth/session.ts` (`apiFetch`) and `src/lib/api/*`, with the dev proxy in `vite.config.ts`.

## 1. Core Technical Competencies

| Skill area | Required capability | Expected level | Primary responsibilities |
| --- | --- | --- | --- |
| React 18+ / 19 | Functional components, hooks, forms, routing, accessible stateful UI | Advanced | App shell, setup flow, workspace, editor, export modal |
| TypeScript 5+ | Strict types, discriminated unions, API/domain models, safe error types | Advanced | Shared contracts and maintainable boundaries |
| Vite | Static SPA configuration, builds, asset handling, deployment | Intermediate | Development and production delivery |
| Tailwind CSS v4 | Responsive layout, design tokens, responsive editor controls | Intermediate | Consistent desktop/mobile presentation |
| Shadcn UI | Composition, customization, accessibility, Radix behavior | Intermediate | Dialogs, cards, inputs, tables, tabs, feedback |
| Modern browser APIs | Clipboard, File, Blob, URL, media capture, storage APIs | Intermediate | Capture and download workflows |
| Git and code review | Small reviewable changes, lockfile/dependency discipline | Intermediate | Team delivery and maintenance |

### Current codebase-specific skills

| Area | Current state | Follow-up skill needed |
| --- | --- | --- |
| Hash routing | Implemented in `App.tsx` with `window.location.hash` + `ProtectedRoute` | Extract route guard/navigation when route count grows |
| PAT auth & session | Implemented in `src/lib/auth/session.ts` (`AuthError` taxonomy, silent validation, 401 auto-eviction) | Add refresh/rotation UX when policy requires it |
| Central networking | `apiFetch` choke point: proxy rewrite, Bearer auth, `credentials: "omit"`, XSRF/AJAX headers | Keep all header/proxy changes in this one function |
| Dev proxy | `vite.config.ts` strips cookies and rewrites Origin/Referer per target | Mirror the rules as reverse-proxy config for production |
| Create SIT Page | Implemented: loads cases from Jira TE, publishes to Confluence | Web-side SIT HTML builder (`QPilotSitTemplateBuilder`) still extension-provided |
| Check & Sync TE | Implemented: compares local cases against Jira TE | Fix latent wrong-PAT usage for Confluence reads |
| Upload Capture | Implemented with extension blob-store path; web fallback pending | Implement web-side blob store/background upload |
| Import Test Case | Implemented: Xray test creation with degraded fallback, repo folder + TE registration | — |
| Create TMP/ISO | UI boundary: `src/components/features/create-tmp-iso` | Refine module UI after review |

### Required implementation practices

- Keep authentication, storage, external-service calls, and serialization logic in `src/lib`, outside presentational components.
- Prefer typed boundaries and explicit error states over untyped response handling.
- Never parse API responses with bare `response.json()`; use the `safeParseJson` helpers (204/empty-body safe).
- Never add Atlassian headers per-request; they belong in `apiFetch` (client) and `prepareProxyReq` (proxy).
- Ensure icon-only controls have accessible names or tooltips.
- Design every feature for desktop and mobile use.

## 2. Data & Persistence Skills

| Skill area | Required capability | Expected level | Application |
| --- | --- | --- | --- |
| Dexie.js | Database definitions, indexes, transactions, migrations | Advanced | Suites, steps, screenshots, annotations |
| IndexedDB | Blob storage, quota behavior, origin scoping, failure handling | Advanced | Offline evidence and draft persistence |
| LocalStorage API | Versioned JSON records, validation, clear/sign-out behavior | Advanced | Optional PAT and preference persistence |
| Browser storage security | Quotas, private browsing, cleanup, data lifecycle | Intermediate | User messaging and resilient storage UX |
| Binary asset handling | Blob, object URLs, MIME validation, URL revocation | Intermediate | Screenshot previews, editing, downloads |

### Data requirements

- Store screenshots as Blobs, never large Base64 strings in `localStorage`.
- Use UUIDs and versioned schemas.
- Save related screenshot metadata and binary data transactionally.
- Delete dependent records and orphaned Blobs safely.
- Provide quota warnings and clear local-data controls.

## 3. Integration Expertise

| Skill area | Required capability | Expected level | Application |
| --- | --- | --- | --- |
| Jira REST API v3 | Issue search/read, status fields, transitions, attachments | Advanced | Direct Jira integration |
| Confluence REST API v2 | Page search/read/create/update, version handling | Advanced | Documentation export |
| PAT authentication | Basic `email:PAT` and Bearer schemes | Advanced | Safe header generation |
| Browser networking | `fetch`, CORS, HTTP status handling, retries, rate limits | Advanced | Typed service clients |
| Atlassian permissions | Project, issue, page, attachment, and space permissions | Intermediate | Troubleshooting and user guidance |

### Integration requirements

- Understand that Jira/Confluence Data Center at BRI enforce XSRF checks on cookie-bearing sessions; all traffic must go through the same-origin proxy with cookies stripped.
- Jira API is v2 (`/rest/api/2`, Xray `/rest/raven/1.0`); Confluence uses `/rest/api` with `X-Requested-With: XMLHttpRequest` on mutations.
- Never expose authorization headers, PATs, or request bodies in logs (reject logs must exclude the `Authorization` header).
- Always send `credentials: "omit"` so browser session cookies never reach Atlassian alongside the PAT.
- Distinguish authentication (401 → auto-evict), authorization (403 → detailed report), CORS, network, conflict, and quota failures via the `AuthError` taxonomy.
- Parse responses with `safeParseJson` — Jira/Confluence return 204/empty bodies on many writes.
- Keep status mappings configurable because Jira workflows vary by installation.

## 4. Canvas & Image Processing

| Skill area | Required capability | Expected level | Application |
| --- | --- | --- | --- |
| HTML5 Canvas API | Rendering, compositing, transforms, export | Advanced | Image editor engine |
| Pointer events | Pointer capture, coordinate conversion, touch support | Advanced | Drawing and selection |
| Image geometry | Crop, rotate, flip, scaling, bounding boxes | Advanced | Predictable natural-pixel editing |
| Annotation modeling | Shapes, text, strokes, blur regions, serialization | Advanced | Persisted editor state |
| History design | Immutable bounded undo/redo snapshots | Intermediate | Reliable editing experience |
| Image formats | PNG, JPEG, WebP MIME selection and quality | Intermediate | Local export and attachments |

### Canvas requirements

- Store coordinates in natural image pixels, not CSS display pixels.
- Support freehand, text, rectangle, ellipse, line, arrow, blur, and pixelation tools.
- Preserve transformations and annotations through save/load cycles.
- Avoid IndexedDB writes on every pointer movement.
- Revoke object URLs when images or previews are replaced or removed.
- Provide a responsive toolbar that works without hover.

## 5. QA & Testing Skills

| Skill area | Required capability | Expected level | Application |
| --- | --- | --- | --- |
| Manual test execution | Step-by-step execution, expected results, statuses | Advanced | Test suite and step builder validation |
| QA documentation | Consistent evidence, screenshots, Jira/Confluence conventions | Advanced | Export quality and review |
| Unit testing | Auth, storage, geometry, serializer, API mapping tests | Intermediate | Domain correctness |
| Component testing | Dialogs, forms, queue, editor controls, feedback states | Intermediate | UI behavior |
| Browser testing | Full workflows, mocked APIs, refresh/offline/conflict cases | Intermediate | Release confidence |
| Accessibility testing | Keyboard, focus, labels, announcements, contrast, mobile | Intermediate | Inclusive operation |
| Security testing | PAT leakage, CSP, XSS, URL validation, data boundaries | Advanced | Client-only threat model |
| Integration testing | CORS, Jira/Confluence permissions and deployment origins | Intermediate | Environment readiness |

### Required QA workflows

1. Configure Jira and Confluence with valid and invalid PATs.
2. Verify independent Jira/Confluence connection states.
3. Create suites and steps, reload, and confirm persistence.
4. Capture by upload, paste, drag/drop, and screen capture where available.
5. Edit screenshots, use undo/redo, save, reload, and download all supported formats.
6. Search Jira issues, update status, and attach selected screenshots.
7. Preview, create, and update Confluence pages.
8. Simulate HTTP 409, 401, 403, CORS failure, offline mode, and storage quota exhaustion.
9. Confirm no PAT or screenshot appears in logs, URLs, analytics, or non-Atlassian requests.

## 6. Recommended Team Composition

| Role | Core ownership | Minimum profile |
| --- | --- | --- |
| Frontend engineer | React/Vite, Tailwind, Shadcn, routing, workspace UI | Advanced React/TypeScript |
| Storage/platform engineer | Dexie, IndexedDB, Blob lifecycle, migrations | Advanced browser persistence |
| Integration engineer | Jira/Confluence APIs, PAT auth, CORS, conflicts | Advanced Atlassian REST |
| Canvas engineer | Canvas rendering, image geometry, annotation model | Advanced Canvas API |
| QA engineer | Manual and automated workflow coverage | Advanced QA documentation |
| Security/accessibility reviewer | Browser storage threat model, CSP, WCAG checks | Intermediate-to-advanced specialist |

One engineer may cover multiple roles for a small team, but the capabilities must be demonstrable before production release.

## 7. Development Standards

- TypeScript models shall be the source of truth for API and storage boundaries.
- Secrets shall never be committed, placed in Vite environment files, or sent to an application-owned service.
- Changes shall include tests for affected domain behavior and user-visible failure states.
- Production support documentation shall include PAT scope/rotation guidance and CORS prerequisites.
- The team shall verify `npm run build` and `npm run lint` before release.

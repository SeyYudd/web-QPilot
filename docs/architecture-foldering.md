# QPilot Architecture and Foldering

> Status: reflects the current implementation in `src/`.

## 1. Purpose

QPilot is a client-only React SPA for creating, annotating, and publishing SIT test evidence. The browser is the application runtime. There is no custom backend, application database server, proxy, server session, or background synchronization service.

## 2. Runtime Architecture

```text
Static HTTPS host
  -> React + Vite SPA
      -> localStorage: optional PAT credentials and preferences
      -> IndexedDB via Dexie: suites, steps, screenshots, annotations
      -> direct fetch: Jira REST API v3
      -> direct fetch: Confluence REST API v2
```

The static host serves the application bundle only. Credentials and test artifacts must never be sent to an application-owned host.

## 3. Source Foldering

```text
src/
  app/
    # Planned boundary; current route/session shell is implemented in App.tsx.
  components/
    auth/
      # Planned extraction; current setup views are in App.tsx.
    workspace/
      # Planned extraction; current sidebar and Create SIT Page are in App.tsx.
    editor/
      # Planned extraction; current editor is in App.tsx.
    export/
      # Planned extraction; current export dialog is in App.tsx.
    ui/
      # Shadcn UI primitives only.
  domain/
    types.ts
      # Implemented shared contracts for credentials, suites, steps, screenshots, annotations.
    canvas.ts
      # Implemented coordinate conversion and annotation rendering helpers.
    templates/
      # Planned serializer boundary; current minimal HTML generation is in App.tsx.
    jira/
      # Planned mapper boundary; current API operations are in infrastructure/api.
    confluence/
      # Planned mapper boundary; current API operations are in infrastructure/api.
  infrastructure/
    storage/
      db.ts
        # Implemented Dexie database definition, seed data, and cleanup transaction.
      credentials.ts
        # Implemented versioned localStorage credential repository.
    api/
      atlassian.ts
        # Implemented direct Jira/Confluence fetch clients and safe error normalization.
```

## 4. Dependency Direction

```text
components -> app/domain/infrastructure
app        -> domain/infrastructure
infrastructure -> domain
domain     -> no UI or browser-specific presentation code
```

Presentational components must not contain direct IndexedDB transactions or raw Atlassian `fetch` calls. They should receive typed data and callbacks from the app/domain boundary.

## 5. Authentication and Route Flow

The application uses light React state for the active session and hash navigation:

```text
isAuthenticated = false
  -> `#/setup` standalone page
  -> non-empty credential submission
  -> isAuthenticated = true
  -> `#/workspace` dashboard
  -> Logout
  -> clear active session
  -> `#/setup`
```

Protected views include the workspace and editor. The setup page renders as a dedicated page, not a modal over protected content. Persisted credentials initialize the session, while logout clears the active session and saved credential record.

## 6. Dashboard Composition

The authenticated shell consists of:

- Top bar with QPilot cube mark, title, subtitle, settings action, and logout action.
- Collapsible sidebar with five navigation items:
  - Create TMP/ISO
  - Create SIT Page
  - Check & Sync TE
  - Upload Capture
  - Import Test Case
- Main view selected from lightweight `navItem` local state.
- Default active view: Create SIT Page.

Non-default menu items may initially render a clear placeholder state. Navigation state should not become a complex menu or state engine.

## 7. Create SIT Page Composition

```text
Create SIT Page | Create Confluence SIT Document
  +------------------------+------------------------------+
  | Form panel             | Preview panel                 |
  | Space Key Confluence   | Coverage: 100                 |
  | Parent Page ID         | Status: Empty                 |
  | Jira Test Execution Key| Tampilan SIT Page             |
  | SIT PAGE NAME          | Expand / Without Expand      |
  | Load Test Cases         | + Add TC                      |
  | Download + Sample      | Test-case table               |
  | Generate SIT PAGE      |                                |
  +------------------------+------------------------------+
```

The form and preview are currently local UI state. `Load Test Cases` displays a local success notification; `Generate SIT PAGE` is currently a UI action without a live Confluence mutation. Existing Jira/Confluence client functions are available for the separate export flow.

## 8. Storage Boundaries

### localStorage

Use only for small settings:

- `sit-web.credentials.v1`
- `sit-web.preferences.v1`

PAT persistence is opt-in. Browser `localStorage` is not an encrypted vault.

### IndexedDB via Dexie

Use for growing or binary local data:

- `suites`
- `steps`
- `screenshots`
- Embedded `CanvasAnnotation[]` values on screenshots

Screenshots must remain Blob values and must not be converted to Base64 for local persistence.

## 9. Security Rules

- Deploy over HTTPS.
- Use direct Jira/Confluence requests only; no proxy workaround.
- Use `credentials: "omit"` for cross-origin requests unless explicitly required.
- Never log PATs, authorization headers, screenshots, or generated page bodies.
- Keep PATs out of URLs, route state, DOM attributes, and telemetry.
- Escape user-controlled text before generating Confluence HTML.
- Show the local-storage risk during setup.
- Require explicit confirmation before remote writes and destructive local cleanup.
- Configure Jira/Confluence CORS for the production application origin.

## 10. Testing Boundaries

- Domain tests: canvas geometry, status mapping, HTML escaping, payload mapping.
- Infrastructure tests: Dexie transactions, credential persistence, API error normalization.
- Component tests: setup form, route guard, sidebar navigation, Create SIT Page controls.
- Browser tests: setup -> dashboard -> logout, editor navigation, export confirmation, offline behavior.

## 11. Change Rules

- Keep feature changes localized to the owning folder.
- Add a domain type before duplicating an object shape in a component.
- Keep route/session state simple until real multi-user requirements exist.
- Do not add a backend, auth library, global state framework, or server proxy without an explicit architecture decision.

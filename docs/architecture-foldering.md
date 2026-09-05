# QPilot Architecture and Foldering

> Status: reflects the current implementation in `src/`. All five modules are implemented with working Jira/Confluence integrations through the dev proxy, typed API clients in `src/lib`, and PAT auth in `src/lib/auth`.

## 1. Purpose

QPilot is a React SPA for creating and reviewing SIT test evidence. The current phase is functional delivery: modules fetch live data from Jira/Confluence Data Center via a same-origin dev proxy and publish results (Xray test creation, TE sync, Confluence SIT pages) with the user's PATs.

## 2. Source Foldering

```text
src/
  components/
    ui/
      # Base/shared UI primitives: Button, Input, Table, Modal, Card, Badge, and feedback.
    features/
      create-tmp-iso/
        # TMP/ISO form and preview table components.
      create-sit-page/
        # SIT Page form, coverage summary, preview, and test-case table components.
      check-sync-te/
        # TE status cards, comparison rows, and sync-log components.
      upload-capture/
        # Scenario/target selectors, image dropzone, and upload queue components.
      import-test-case/
        # Excel import modal, workbook preview, validation, and parser components.
  lib/
    auth/
      session.ts
        # PAT session (localStorage), AuthError taxonomy, apiFetch (central fetch
        # choke point: proxy URL rewrite, Bearer auth, XSRF/AJAX headers,
        # credentials: "omit"), authorizedFetch, toProxyUrl.
    api/
      jira.ts
        # Jira client (createJiraClient, fetchJiraCurrentUser), 401 auto-eviction,
        # safeParseJson, detailed reject logging.
      confluence.ts
        # Confluence client (createConfluenceClient), XSRF/AJAX headers for
        # mutations, 401 auto-eviction, safeParseJson.
    jira-api.ts
      # Higher-level Jira/Xray operations (issue lookup, linking, TE sync).
    confluence-api.ts
      # Higher-level Confluence operations (page create/read).
  hooks/
    # Feature hooks (e.g. useCompareLogic for Check & Sync TE).
  pages/
    # Route-level pages (Login, Dashboard).
  app/
    # Routing and provider boundary (App.tsx, ProtectedRoute).
  domain/
    types.ts
      # Shared contracts used by feature components and integrations.
```

Feature directory names must always be kebab-case. Use `create-sit-page`, not `Create SIT Page` or `CreateSitPage`.

## 3. Dependency Direction

```text
components/features -> components/ui, lib/api, lib/auth, hooks, domain
pages/app           -> components/features, lib
lib                 -> typed contracts; no UI or presentation code
```

Feature components compose shared primitives and call Jira/Confluence through the typed clients in `src/lib/api` and the shared helpers in `src/components/features/shared.tsx` (`requestApi`) and `src/components/features/import-test-case/jiraImport.ts` (`api`). All networking funnels into `apiFetch`, which applies the proxy rewrite and auth headers; features never call raw `fetch` themselves. When running inside the Chrome extension, `window.qpilotApiFetch` takes precedence over `apiFetch` (extension client fallback).

## 4. Dashboard Composition

The UI shell consists of a top bar, collapsible sidebar, page context, main content area, toast feedback, and confirmation dialogs. The sidebar routes to:

- `create-tmp-iso` - Create TMP/ISO
- `create-sit-page` - Create SIT Page
- `check-sync-te` - Check & Sync TE
- `upload-capture` - Upload Capture
- `import-test-case` - Import Test Case

The default active view is `create-sit-page`. Each module renders from its matching `src/components/features/<kebab-case-module-name>` boundary.

## 5. Feature Boundaries

### `create-tmp-iso`

Contains the TMP/ISO form and local preview outline. No Jira or Confluence behavior is invented in this custom module.

### `create-sit-page`

Contains document details, local test-case rows using `action`, `data`, and `expectedResult`, coverage summary, storage-format preview, and local generation feedback.

### `check-sync-te`

Contains Jira/Xray-shaped mock test rows, exact comparison statuses, separate capture badges, row-level actions, and confirmation previews. It must not add Select All, Reorder Mode, or bulk mutations.

### `upload-capture`

Contains scenario and target selectors, image dropzone, upload controls, clipboard affordance, queue metadata, and simulated per-file progress.

### `import-test-case`

Contains workbook intake, template action, validation notes, preview table, include/exclude controls, inline results, edit affordances, and simulated sequential import with retry-failed-only behavior.

## 6. Data Rules

- Keep API access inside `src/lib` (clients) — never inline `fetch` in feature components.
- Use realistic Jira test keys, Test Execution keys, test case IDs, assignees, Xray statuses, and Confluence page names in fixtures/tests.
- Use confirmation dialogs for destructive and remote-write actions.
- Preserve exact shared step names: `action`, `data`, and `expectedResult`.

## 7. Testing Boundaries

- Component tests cover sidebar navigation, feature forms, tables, dialogs, validation, upload queues, and import previews.
- Integration tests cover the typed clients (`apiFetch` proxy rewrite, 401 eviction, `safeParseJson`, XSRF headers) with mocked responses.
- Browser tests cover all five kebab-case routes, responsive navigation, async states, and destructive-action confirmation.

## 8. Change Rules

- Keep feature changes localized to `src/components/features/<kebab-case-module-name>`.
- Put genuinely reusable primitives in `src/components/ui` and shared API helpers in `src/lib`.
- Avoid one-off abstractions and giant page components.
- Networking changes (headers, proxy, auth) must be made in `apiFetch`/`vite.config.ts` — the two choke points — not per feature.

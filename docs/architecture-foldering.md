# QPilot Architecture and Foldering

> Status: reflects the current UI-first implementation in `src/`.

## 1. Purpose

QPilot is a React SPA for creating and reviewing SIT test evidence. The current phase is UI/UX development only. All five modules use local React state, realistic mock data, client-side validation, and simulated async behavior. Backend, authentication, database, and external service work are intentionally deferred until UI approval.

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
  app/
    # Future routing and provider boundary.
  domain/
    types.ts
      # Shared contracts used by feature components and future integrations.
```

Feature directory names must always be kebab-case. Use `create-sit-page`, not `Create SIT Page` or `CreateSitPage`.

## 3. Dependency Direction

```text
components/features -> components/ui and typed local feature state
app                 -> components/features and domain
domain              -> no UI or presentation code
```

Feature components compose shared primitives and local mock state. They must not contain backend calls, authentication, database transactions, or external-service requests during the UI phase.

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

## 6. UI-Phase Data Rules

- Keep mock data separate from feature presentation when the data is reused.
- Use realistic Jira test keys, Test Execution keys, test case IDs, assignees, Xray statuses, and Confluence page names.
- Use local state and mock data only until the complete UI is approved.
- Use confirmation dialogs for destructive local actions.
- Preserve exact shared step names: `action`, `data`, and `expectedResult`.

## 7. Testing Boundaries

- Component tests cover sidebar navigation, feature forms, tables, dialogs, validation, upload queues, and import previews.
- Browser tests cover all five kebab-case routes, responsive navigation, simulated async states, and destructive-action confirmation.

## 8. Change Rules

- Keep feature changes localized to `src/components/features/<kebab-case-module-name>`.
- Put genuinely reusable primitives in `src/components/ui`.
- Avoid one-off abstractions and giant page components.
- Do not add backend, authentication, database, or Jira/Xray/Confluence integrations before explicit UI approval.

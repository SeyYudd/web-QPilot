# Business Requirements Document (BRD)

> Status: aligned with the current QPilot SPA implementation. The current release is a client-side prototype with local persistence and partial Atlassian publishing.

## 1. Executive Summary & Project Background

The SIT Web Generator will replace a desktop/extension-based automated test capture workflow with a browser-native quality assurance tool. The product will run as a static React application and allow QA users to capture evidence, build test documentation, annotate screenshots, and explicitly publish results to Jira and Confluence.

The solution is client-only. Credentials and drafts remain in the user's browser, while Jira and Confluence receive data only through user-initiated direct requests. No application-owned backend, database server, proxy, or server-side job is permitted.

## 2. Business Problem & Solution Vision

### Current problem

- Extension or desktop dependencies make setup and distribution difficult.
- Test evidence is separated from structured test steps.
- Screenshot annotation and documentation generation require manual work.
- Remote updates to Jira and Confluence are disconnected from capture activity.
- Centralized storage would introduce operational, privacy, and credential-management overhead.

### Solution vision

Provide a browser-native QA workspace that combines local test authoring, screenshot capture, canvas annotation, and controlled Atlassian export in one workflow:

`PAT setup -> capture workspace -> image editor -> Jira/Confluence export`

The tool should be usable offline for drafting and editing, while remote operations remain explicit and transparent.

### Current delivery state

- The authenticated QPilot shell and standalone setup page are implemented.
- Create SIT Page is the default dashboard module.
- The other four sidebar modules currently provide placeholder views.
- Local suites, steps, screenshot capture, annotation, and download flows are implemented.
- The separate export dialog exposes Jira and Confluence actions.
- Create SIT Page `Load Test Cases` and `Generate SIT PAGE` currently require further integration work.

## 3. Business Objectives & KPIs

### Objectives

- Reduce time from test execution to documented evidence.
- Eliminate installation friction associated with desktop and extension workflows.
- Improve consistency of screenshot annotation and test documentation.
- Reduce duplicate entry between local test results, Jira, and Confluence.
- Keep customer credentials and working data outside application-owned infrastructure.

### Proposed KPIs

| KPI | Measurement | Target |
| --- | --- | --- |
| Capture-to-document time | Median time from first capture to export | Reduce by 40% from baseline |
| Evidence completion | Captures with linked suite/step and final annotation | At least 90% |
| Export success | Explicit Jira/Confluence actions completing without retry | At least 98% excluding CORS/permission failures |
| Local resilience | Drafts retained after refresh/offline use | 100% of supported local operations |
| Adoption | QA users completing a full workflow without extension installation | At least 80% of pilot users |
| Security incidents | PATs sent to app-owned services or logs | Zero |
| Accessibility | Critical workflow pass rate in keyboard/accessibility review | 100% of release criteria |

Targets must be baselined during pilot validation and may be refined without changing the architecture.

## 4. Stakeholder Roles & Persona Definition

### QA Engineers

- Capture screenshots and associate evidence with test suites and steps.
- Annotate defects, regions, and expected results on images.
- Update Jira status and attach evidence.
- Export complete test documentation to Confluence.

Success means less context switching and reliable evidence linked to the correct test.

### Testers

- Execute or review step-by-step test cases.
- Record action, data, expected result, and status.
- Use the capture queue and image editor with minimal training.
- Work offline and publish when connectivity is available.

Success means a clear, repeatable workflow for producing test evidence.

### Project Leads and QA Leads

- Define project/Jira configuration and status mappings.
- Review Confluence documentation output.
- Monitor adoption, export failures, and workflow consistency.
- Set policies for PAT scope, retention, and supported Atlassian deployments.

Success means improved reporting quality without operating another backend service.

### Platform/Security Administrators

- Configure Jira and Confluence CORS for the deployed origin.
- Establish PAT issuance, scope, rotation, and revocation policy.
- Approve static hosting, CSP, dependency, and privacy controls.

## 5. Scope of Work

### In scope

- React/Vite static client application.
- Responsive Tailwind CSS and Shadcn UI interface.
- Login/PAT setup for Jira and Confluence.
- Optional local credential persistence through `localStorage`.
- Local test suites and structured steps.
- Screenshot upload, paste, drag/drop, and optional screen capture.
- Dexie/IndexedDB persistence for suites, steps, annotations, and screenshot Blobs.
- Canvas tools including crop, transforms, freehand, text, shapes, blur, undo, redo, and export.
- Direct Jira REST API v3 issue lookup, status update, and screenshot attachment.
- Direct Confluence REST API v2 page creation through the export flow.
- Confluence page search and optimistic-concurrency update remain planned.
- Confluence storage-format HTML generation and preview.
- Offline drafting, storage cleanup, quota feedback, and explicit remote actions.
- Accessibility, security, automated testing, and production-origin CORS validation.

### Out of scope

- Backend database server.
- Application-owned API or proxy.
- Server-side PAT storage, token exchange, or sessions.
- Automatic synchronization or background uploads.
- Automatic reading/manipulation of arbitrary browser tabs.
- Centralized screenshot hosting or application telemetry containing user data.
- Replacement of Jira or Confluence workflow configuration.

## 6. High-Level System Architecture & Security

### Architecture

```text
Static HTTPS host
        |
        v
React/Vite application in user browser
  |             |                |
  v             v                v
localStorage  IndexedDB       Direct fetch
PAT/config    Dexie data      Jira / Confluence
```

The static host serves HTML, JavaScript, CSS, and icons only. It must not receive credentials, screenshots, drafts, analytics payloads, or generated page bodies.

### PAT storage

By default, PATs remain in memory. If the user selects **Remember credentials**, a versioned credentials record is stored in `localStorage`. The UI must explain that browser storage is not encrypted and is readable by JavaScript running in the same origin.

The product must support **Sign out**, **Clear credentials**, and **Clear all local data**. Users should use narrowly scoped, revocable PATs and avoid shared or unmanaged devices.

### CORS and deployment

Jira and Confluence must allow the production web origin through CORS. Adding a frontend header cannot resolve a CORS restriction. A failed connection must identify CORS/network conditions separately from 401, 403, 404, 409, and quota errors.

### Security principles

- HTTPS-only production deployment.
- Strict CSP and dependency audit.
- No secrets in URLs, logs, telemetry, or error reporting.
- Explicit confirmation before status changes, attachments, and page updates.
- Sanitized Confluence preview and escaped user-controlled text.
- Clear local data ownership and retention messaging.

## 7. Business Acceptance Criteria

- A QA user can configure Jira and/or Confluence without an application account.
- A user can create a suite, add steps, capture screenshots, and work offline.
- A user can annotate and save screenshots without losing data on refresh.
- A user can preview and explicitly send selected evidence to Jira or Confluence.
- Jira and Confluence failures do not corrupt local drafts.
- No application-owned server stores PATs or test artifacts.
- The release passes build, lint, accessibility, security, storage, and browser workflow tests.

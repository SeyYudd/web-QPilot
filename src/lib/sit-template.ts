// lib/sit-template.ts — Generator storage-format HTML untuk SIT Page Confluence.
// Port 1:1 dari engine extension (sit-template-builder.js, V2 Standard) agar
// hasil halaman Confluence identik antara extension dan web.
// Pure function tanpa akses window/DOM — testable terpisah dari UI.

export type SitStep = { action: string; data: string; expectedResult: string };

export type SitTestCase = {
  key: string;
  summary?: string;
  scenario?: string;
  functionName?: string;
  steps: SitStep[];
};

export function escapeHtml(value: unknown): string {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function asConfluenceHtml(value: unknown): string {
  if (!value) return "<p></p>";
  return String(value)
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

export function buildSingleTcHtml(
  tc: SitTestCase,
  index: number,
  displayMode: "expand" | "table" = "expand",
): string {
  const tcId = `TC${String(index + 1).padStart(3, "0")}`;
  const steps =
    (tc.steps || [])
      .map((step, i) => `${i + 1}. ${step.action || "-"}`)
      .join("\n") || "1. -";
  const data = (tc.steps || []).map((step) => step.data || "-").join("\n") || "-";
  const expected =
    (tc.steps || []).map((step) => step.expectedResult || "-").join("\n") || "-";
  const open =
    displayMode === "expand"
      ? `<ac:structured-macro ac:name="expand" ac:schema-version="1"><ac:parameter ac:name="title">${tcId} - ${escapeHtml(tc.key)} - ${escapeHtml(tc.summary)}</ac:parameter><ac:rich-text-body>`
      : "";
  let html = `${open}<table class="wrapped"><tbody>`;
  html += `<tr><td style="width:20%;"><strong>No. Test Case</strong></td><td style="width:80%;">${escapeHtml(tcId)}</td></tr>`;
  html += `<tr><td style="width:20%;"><strong>Key</strong></td><td style="width:80%;">${escapeHtml(tc.key)}<br/>`;
  html += `<ac:structured-macro ac:name="jira" ac:schema-version="1"><ac:parameter ac:name="jqlQuery">key = &quot;${escapeHtml(tc.key)}&quot;</ac:parameter><ac:parameter ac:name="columns">key,summary,assignee,Expected Result,TestRunStatus</ac:parameter></ac:structured-macro></td></tr>`;
  ([
    ["Scenario", tc.scenario || ""],
    ["Function", tc.functionName || ""],
    ["Steps", steps],
    ["Data", data],
    ["Expected Result", expected],
  ] as const).forEach(([label, value]) => {
    html += `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${asConfluenceHtml(value)}</td></tr>`;
  });
  html += '<tr><td><strong>Result</strong></td><td><p>PASS / <s>FAILED</s></p><p>*) Coret salah satu melalui toolbar Confluence</p></td></tr>';
  html += `<tr><td><strong>Screen Capture</strong></td><td><ac:structured-macro ac:name="expand" ac:schema-version="1"><ac:parameter ac:name="title">Screen Capture</ac:parameter><ac:rich-text-body><p>Untuk Evidence...</p></ac:rich-text-body></ac:structured-macro></td></tr>`;
  return `${html}</tbody></table>${displayMode === "expand" ? "</ac:rich-text-body></ac:structured-macro>" : ""}`;
}

export function buildFullStorageHtml(
  _teSummary: string,
  testCases: SitTestCase[],
  displayMode: "expand" | "table" = "expand",
): string {
  let html = '<ac:layout><ac:layout-section ac:type="single"><ac:layout-cell>';
  html += "<p><strong>TEST SCENARIO DETAIL &amp; SCREEN CAPTURE UAT</strong></p>";
  html += '</ac:layout-cell></ac:layout-section><ac:layout-section ac:type="single"><ac:layout-cell>';
  (testCases || []).forEach((tc, index) => {
    html += buildSingleTcHtml(tc, index, displayMode);
  });
  return `${html}</ac:layout-cell></ac:layout-section></ac:layout>`;
}

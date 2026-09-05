import type { JiraIssue, XrayTestRun, XrayTestRunRecord } from "../types";
import { createJiraClient } from "./api/jira";

export interface JiraClient { request<T>(url: string, options?: RequestInit): Promise<T>; }
export { createJiraClient };

export function extractTestSteps(issue: JiraIssue) {
  const fields = issue.fields || {};
  for (const value of [fields.customfield_11404, ...Object.values(fields)]) {
    const rows = Array.isArray(value) ? value : value && typeof value === "object" && "steps" in value ? (value as { steps?: unknown[] }).steps : [];
    if (!Array.isArray(rows)) continue;
    const mapped = rows.map((item) => {
      const source = (item && typeof item === "object" && "fields" in item ? (item as { fields?: unknown }).fields : item) as Record<string, unknown> || {};
      return { action: String(source.Action || source.action || source.rawAction || source.step || ""), data: String(source.Data || source.data || source.rawData || ""), expectedResult: String(source["Expected Result"] || source.expectedResult || source.result || source.rawExpectedResult || source.expected || "") };
    }).filter((step) => step.action || step.data || step.expectedResult);
    if (mapped.length) return mapped;
  }
  return [];
}

export function xrayTestKeys(data: XrayTestRun[] | { tests?: XrayTestRun[] }, executionKey = "") {
  // `/testexec/{key}/test` is the only authority for execution membership.
  // Never inspect Jira issue-link fields or a generic `issues` collection here.
  const values = Array.isArray(data) ? data : data.tests || [];
  const selfKey = executionKey.trim().toUpperCase();
  return [...new Set(values.map((item) => typeof item === "string" ? item : item.key || item.issueKey).filter((key): key is string => {
    if (!key || !/^[A-Z][A-Z0-9]+-\d+$/i.test(key)) return false;
    return key.toUpperCase() !== selfKey;
  }))];
}

export function parseScopedTestKeys(html: string, executionKey: string) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  doc.querySelectorAll("#issuelinks, #linkingmodule, .links-module").forEach((node) => node.remove());
  const testsContainer = doc.querySelector("#testruns-table-container, #ghx-xray-test-execution");
  if (!testsContainer) return [];
  const selfKey = executionKey.trim().toUpperCase();
  const keyPattern = /[A-Z][A-Z0-9]+-\d+/gi;
  const keys = [...testsContainer.querySelectorAll("a, [data-issue-key], [data-key]")].flatMap((element) => {
    const values = [element.textContent || "", element.getAttribute("href") || "", element.getAttribute("data-issue-key") || "", element.getAttribute("data-key") || ""];
    return values.flatMap((value) => value.match(keyPattern) || []);
  });
  return [...new Set(keys.map((key) => key.toUpperCase()).filter((key) => key !== selfKey))];
}

export function executionStatus(item: XrayTestRun): "TODO" | "PASS" | "FAIL" {
    const raw = typeof item === "string" ? "TODO" : typeof item.status === "object" && item.status !== null ? (item.status as { name?: string }).name : item.status;
  const normalized = String(raw || "TODO").toUpperCase();
  return normalized === "PASS" || normalized === "FAIL" ? normalized : "TODO";
}

export async function getTestExecution(client: JiraClient, baseUrl: string, key: string) {
  const issue = await client.request<JiraIssue>(`${baseUrl}/rest/api/2/issue/${encodeURIComponent(key)}?expand=names,schema`);
  if (String((issue.fields?.issuetype as { name?: string } | undefined)?.name || "").toLowerCase() !== "test execution") throw new Error("Key yang dimasukkan bukan Jira Test Execution.");
  const runs = await client.request<XrayTestRun[] | { tests?: XrayTestRun[] }>(`${baseUrl}/rest/raven/1.0/api/testexec/${encodeURIComponent(key)}/test`);
  const keys = xrayTestKeys(runs, key);
  const issues = await Promise.all(keys.map((testKey) => client.request<JiraIssue>(`${baseUrl}/rest/api/2/issue/${encodeURIComponent(testKey)}?expand=names,renderedFields,schema&fields=summary,assignee,status,rank,customfield_11404,customfield_10000`)));
  // The Xray membership response is the TE's persisted order. Jira's rank
  // cursor is not a numeric position and can change when issues are edited.
  const originalByKey = new Map(issues.map((item) => [item.key.toUpperCase(), item]));
  const orderedIssues = keys.map((testKey) => originalByKey.get(testKey.toUpperCase())).filter((item): item is JiraIssue => Boolean(item));
  return { issue, runs, keys: orderedIssues.map((item) => item.key), issues: orderedIssues };
}

export async function addTestToExecution(client: JiraClient, baseUrl: string, executionKey: string, testKey: string) {
  // Xray Server expects the association operation as a list, not testIssueKey.
  return client.request(`${baseUrl}/rest/raven/1.0/api/testexec/${encodeURIComponent(executionKey)}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ add: [testKey] }) });
}

export async function reorderTestsInExecution(client: JiraClient, baseUrl: string, executionKey: string, testKeys: string[]) {
  try {
    return await client.request(`${baseUrl}/rest/raven/1.0/api/testexec/${encodeURIComponent(executionKey)}/test`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testIssueKeys: testKeys }) });
  } catch (error) {
    if (String(error instanceof Error ? error.message : error).includes("405")) throw new Error("Xray REST API menolak reorder (HTTP 405). Endpoint ini tidak menyediakan operasi reorder pada instalasi Jira ini.", { cause: error });
    throw error;
  }
}

// Link dua issue Jira. Contoh untuk Test Plan: linkTestExecutionToPlan membuat
// TE "is contained in" TP, dan TP "contains" TE.
export async function linkIssues(client: JiraClient, baseUrl: string, linkType: string, inwardKey: string, outwardKey: string) {
  return client.request(`${baseUrl}/rest/api/2/issueLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: { name: linkType },
      inwardIssue: { key: inwardKey },
      outwardIssue: { key: outwardKey },
    }),
  });
}

export async function removeTestFromExecution(client: JiraClient, baseUrl: string, executionKey: string, testKey: string) {
  return client.request(`${baseUrl}/rest/raven/1.0/api/testexec/${encodeURIComponent(executionKey)}/test/${encodeURIComponent(testKey)}`, { method: "DELETE" });
}

export async function setTestRunStatus(client: JiraClient, baseUrl: string, executionKey: string, testKey: string, status: string) {
  const run = await client.request<XrayTestRunRecord | XrayTestRunRecord[]>(`${baseUrl}/rest/raven/1.0/api/testrun?testExecIssueKey=${encodeURIComponent(executionKey)}&testIssueKey=${encodeURIComponent(testKey)}`);
  const runId = Array.isArray(run) ? run[0]?.id : run.id;
  if (!runId) throw new Error(`Test Run untuk ${testKey} tidak ditemukan.`);
  await client.request(`${baseUrl}/rest/raven/1.0/api/testrun/${encodeURIComponent(String(runId))}/status?status=${encodeURIComponent(status)}`, { method: "PUT" });
}

export const setTestRunPass = (client: JiraClient, baseUrl: string, executionKey: string, testKey: string) => setTestRunStatus(client, baseUrl, executionKey, testKey, "PASS");

export async function transitionIssueDone(client: JiraClient, baseUrl: string, key: string) {
  const data = await client.request<{ transitions?: Array<{ id: string; name?: string; to?: { name?: string } }> }>(`${baseUrl}/rest/api/2/issue/${encodeURIComponent(key)}/transitions`);
  const done = data.transitions?.find((transition) => /^(done|complete|completed)$/i.test(transition.name || "") || /^(done|complete|completed)$/i.test(transition.to?.name || ""));
  if (!done) throw new Error("Transition Jira ke Done tidak ditemukan atau tidak tersedia.");
  await client.request(`${baseUrl}/rest/api/2/issue/${encodeURIComponent(key)}/transitions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transition: { id: done.id } }) });
}

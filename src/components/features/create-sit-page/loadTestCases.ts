import type { StepRow, TestCase } from "@/components/features/shared";
import { requestApi } from "@/components/features/shared";
import { getJiraBaseUrl } from "@/lib/auth/session";
import type { JiraIssue } from "@/types";

function stepText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value))
    return value.map(stepText).filter(Boolean).join("\n");
  if (typeof value === "object" && "text" in value)
    return stepText((value as { text?: unknown }).text);
  return JSON.stringify(value);
}

function extractIssueSteps(issue: JiraIssue) {
  const fields = issue.fields || {};
  const named = Object.entries(issue.names || {})
    .filter(([, label]) =>
      /manual test steps|test steps|steps/i.test(String(label)),
    )
    .map(([id]) => id);
  for (const id of [
    ...new Set(["customfield_11404", ...named, ...Object.keys(fields)]),
  ]) {
    const value = fields[id];
    const rows = Array.isArray(value)
      ? value
      : value && typeof value === "object" && "steps" in value
        ? ((value as { steps?: unknown[] }).steps ?? [])
        : [];
    if (!Array.isArray(rows)) continue;
    const mapped = rows
      .map((item) => {
        const source = ((item && typeof item === "object" && "fields" in item
          ? (item as { fields?: unknown }).fields
          : item) ||
          {}) as Record<string, unknown>;
        return {
          action: stepText(
            source.Action ?? source.action ?? source.rawAction ?? source.step,
          ),
          data: stepText(source.Data ?? source.data ?? source.rawData),
          expectedResult: stepText(
            source["Expected Result"] ??
              source.expectedResult ??
              source.result ??
              source.rawExpectedResult ??
              source.expected,
          ),
        };
      })
      .filter((step) => step.action || step.data || step.expectedResult);
    if (mapped.length) return mapped;
  }
  return [];
}

export const cleanStepNumber = (value: string) =>
  String(value || "").replace(/^\s*(?:\d+[.)]?\s*)+/, "");

export async function loadTestCases(
  teKey: string,
): Promise<{ summary: string; testCases: TestCase[] }> {
  const jiraBase = await getJiraBaseUrl();
  const teIssue = await requestApi(
    `${jiraBase}/rest/api/2/issue/${encodeURIComponent(teKey)}?expand=names,schema`,
  );
  if (
    String(teIssue.fields?.issuetype?.name || "").toLowerCase() !==
    "test execution"
  )
    throw new Error("Key harus berupa Jira Test Execution.");
  const list = await requestApi(
    `${jiraBase}/rest/raven/1.0/api/testexec/${encodeURIComponent(teKey)}/test`,
  );
  const values =
    Array.isArray(list) ? list : (list?.tests || list?.issues || []);
  const keys = [
    ...new Set(
      values
        .map((item: unknown) =>
          typeof item === "string"
            ? item
            : ((item as { key?: string })?.key ||
              (item as { issueKey?: string })?.issueKey),
        )
        .filter((key: string) => /^[A-Z][A-Z0-9]+-\d+$/i.test(key || "")),
    ),
  ] as string[];
  if (!keys.length) throw new Error("Silakan masukkan Test terlebih dahulu.");
  const testCases = await Promise.all(
    keys.map(async (key: string, index) => {
      const issue = await requestApi(
        `${jiraBase}/rest/api/2/issue/${encodeURIComponent(key)}?expand=names,renderedFields,schema`,
      );
      const steps = extractIssueSteps(issue);
      const cleanSteps = steps.map((step: StepRow) => ({
        action: cleanStepNumber(step.action),
        data: step.data,
        expectedResult: step.expectedResult,
      }));
      return {
        no: index + 1,
        key,
        summary: issue.fields?.summary || key,
        scenario: issue.fields?.summary || key,
        function: teIssue.fields?.summary || teKey,
        steps: cleanSteps.map((step: StepRow) => step.action).join("\n"),
        data: cleanSteps.map((step: StepRow) => step.data).join("\n"),
        expectedResult: cleanSteps
          .map((step: StepRow) => step.expectedResult)
          .join("\n"),
        stepRows: cleanSteps,
      };
    }),
  );
  return { summary: teIssue.fields?.summary || teKey, testCases };
}

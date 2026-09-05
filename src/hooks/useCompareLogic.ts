import { useMemo, useState } from "react";
import { JIRA_BASE_URL, CONFLUENCE_BASE_URL } from "@/lib/auth/session";
import {
  compareRows,
  extractPageId,
  fixPositionMutation,
  updateConfluence,
  type ConfluencePage,
} from "@/lib/confluence-api";
import { createConfluenceClient } from "@/lib/api/confluence";
import {
  createJiraClient,
  executionStatus,
  getTestExecution,
} from "@/lib/jira-api";
import type { CompareSummary, ComparisonResult } from "@/types";

export function useCompareLogic() {
  const [rows, setRows] = useState<ComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");
  const notify = (text: string, nextTone: "info" | "success" | "error" = "success") => {
    setTone(nextTone);
    setMessage(text);
  };
  const dismissMessage = () => setMessage("");

  const summary: CompareSummary = useMemo(
    () => ({
      jiraTotal: rows.filter((row) => row.status !== "Extra di Confluence").length,
      confluenceTotal: rows.length,
      match: rows.filter((row) => row.status === "Match").length,
      differentOrder: rows.filter((row) => row.status === "Urutan berbeda").length,
      missing: rows.filter((row) => row.status === "Missing di Confluence").length,
      extra: rows.filter((row) => row.status === "Extra di Confluence").length,
      captured: rows.filter((row) => /has image/i.test(row.capture)).length,
    }),
    [rows],
  );

  const compare = async (pageId: string, executionKey: string) => {
    const normalizedPageId = extractPageId(pageId) || pageId.trim();
    if (!normalizedPageId || !executionKey.trim()) {
      notify("Isi Confluence Page ID dan Jira Test Execution Key terlebih dahulu.", "info");
      return null;
    }
    setLoading(true);
    try {
      const jiraBase = JIRA_BASE_URL;
      const confBase = CONFLUENCE_BASE_URL;
      const client = createJiraClient(jiraBase);
      const execution = await getTestExecution(client, jiraBase, executionKey.trim().toUpperCase());
      // Confluence read memakai Confluence PAT (bukan Jira PAT) via client khusus.
      const confClient = createConfluenceClient(confBase);
      const page = await confClient.request<ConfluencePage>(
        `${confBase}/rest/api/content/${encodeURIComponent(normalizedPageId)}?expand=body.storage`,
      );
      const statuses = new Map<string, ComparisonResult["teStatus"]>();
      const runs = Array.isArray(execution.runs) ? execution.runs : execution.runs.tests || [];
      runs.forEach((run) => {
        if (typeof run === "string") return;
        const key = String(run.key || run.issueKey || "").toUpperCase();
        if (key) statuses.set(key, executionStatus(run));
      });
      setRows(compareRows(execution.keys, page.body?.storage?.value || "", statuses));
      return { jiraBase, confBase };
    } catch (error) {
      setRows([]);
      notify(error instanceof Error ? error.message : "Gagal menjalankan Compare.", "error");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fixPosition = async (pageId: string, _jiraBase: string, confBase: string) => {
    setLoading(true);
    try {
      const normalizedPageId = extractPageId(pageId) || pageId.trim();
      const order = rows
        .filter((row) => row.status !== "Extra di Confluence")
        .map((row) => row.key);
      // Mutasi Confluence (Fix Position) memakai Confluence PAT + header XSRF.
      const confClient = createConfluenceClient(confBase);
      const done = await updateConfluence(confClient, confBase, normalizedPageId, fixPositionMutation(order));
      if (!done) throw new Error("Gagal memperbaiki posisi test case di Confluence.");
      notify("Posisi Confluence berhasil diperbaiki sesuai urutan Jira TE.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Fix position gagal.", "error");
    } finally {
      setLoading(false);
    }
  };

  return {
    rows,
    summary,
    loading,
    message,
    tone,
    dismissMessage,
    compare,
    fixPosition,
  };
}

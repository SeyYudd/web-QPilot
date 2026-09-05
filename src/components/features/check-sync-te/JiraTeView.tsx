import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fieldClass } from "@/components/features/shared";
import { getJiraBaseUrl } from "@/lib/auth/session";
import {
  addTestToExecution,
  createJiraClient,
  removeTestFromExecution,
  setTestRunStatus,
} from "@/lib/jira-api";

function teStatusVariant(status: string): "success" | "destructive" | "warning" | "neutral" {
  if (status === "PASS") return "success";
  if (status === "FAIL") return "destructive";
  if (status === "ABORTED") return "neutral";
  return "warning";
}

export default function JiraTeView({
  executionKey,
  onChanged,
}: {
  executionKey: string;
  onChanged: () => void;
}) {
  const [key, setKey] = useState(executionKey);
  const [items, setItems] = useState<
    Array<{
      key: string;
      summary: string;
      rank: string;
      assignee: string;
      status: string;
    }>
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("PASS");
  const [bulkResult, setBulkResult] = useState("");
  const updateBulkStatus = async () => {
    if (!selected.length || !window.confirm(`Ubah ${selected.length} Test Case menjadi ${bulkStatus}?`)) return;
    setBusy(true);
    setBulkResult("");
    try {
      const base = await getJiraBaseUrl();
      const results = await Promise.all(selected.map(async (testKey) => {
        try { await setTestRunStatus(createJiraClient(base), base, key.trim().toUpperCase(), testKey, bulkStatus); return `${testKey}: berhasil`; }
        catch (error) { return `${testKey}: gagal (${error instanceof Error ? error.message : "unknown error"})`; }
      }));
      const resultMessage = results.join(" | ");
      setBulkResult(resultMessage);
      setMessage(resultMessage);
      setSelected([]);
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const load = async () => {
    if (!key.trim()) return setMessage("Isi Jira TE terlebih dahulu.");
    setBusy(true);
    setMessage("");
    try {
      const base = await getJiraBaseUrl();
      const client = createJiraClient(base);
      const result = await import("@/lib/jira-api").then(
        ({ getTestExecution }) =>
          getTestExecution(client, base, key.trim().toUpperCase()),
      );
      const next = await Promise.all(
        result.keys.map(async (testKey) => {
          const issue = await client.request<{
            fields?: {
              summary?: string;
              assignee?: { displayName?: string; name?: string; accountId?: string };
              rank?: unknown;
              customfield_10000?: unknown;
            };
          }>(
            `${base}/rest/api/2/issue/${encodeURIComponent(testKey)}?fields=summary,assignee,status,rank,customfield_10000`,
          );
           const run = (Array.isArray(result.runs) ? result.runs : result.runs.tests || []).find((candidate) => typeof candidate !== "string" && String(candidate.key || candidate.issueKey).toUpperCase() === testKey.toUpperCase());
           const assignee = issue.fields?.assignee;
           const runAssignee = run && typeof run !== "string" ? run.assignee : undefined;
           return {
             key: testKey,
             summary: issue.fields?.summary || "",
             rank: String(issue.fields?.rank || issue.fields?.customfield_10000 || ""),
             assignee: assignee?.displayName || assignee?.name || assignee?.accountId || (typeof runAssignee === "string" ? runAssignee : (runAssignee as { displayName?: string; name?: string } | undefined)?.displayName || (runAssignee as { name?: string } | undefined)?.name) || "Unassigned",
             status: typeof run === "string" ? "TODO" : String(run?.status && typeof run.status === "object" && run.status !== null ? (run.status as { name?: string }).name : run?.status || "TODO").toUpperCase(),
          };
        }),
      );
      // Bersihkan urutan basi dari build lama; tampilan selalu mengikuti urutan Xray/Jira.
      if (typeof chrome !== "undefined" && chrome.storage?.local) chrome.storage.local.remove(`qpilot_jira_te_order_${key.trim().toUpperCase()}`);
      setItems(next);
      setMessage(`${next.length} Test ditemukan.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Gagal memuat Jira TE.",
      );
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    const testKey = input.trim().toUpperCase();
    if (
      !/^\d+$/.test(testKey.split("-").pop() || "") ||
      !/^[A-Z][A-Z0-9]+-\d+$/.test(testKey)
    )
      return setMessage("Masukkan tiket Jira yang valid, contoh PROJ-123.");
    setBusy(true);
    try {
      const base = await getJiraBaseUrl();
      if (items.some((item) => item.key.toUpperCase() === testKey)) {
        throw new Error(`${testKey} sudah ada di Jira TE.`);
      }
      const issue = await createJiraClient(base).request<{
        fields?: { issuetype?: { name?: string } };
      }>(`${base}/rest/api/2/issue/${encodeURIComponent(testKey)}?fields=issuetype`);
      if (String(issue.fields?.issuetype?.name || "").toLowerCase() !== "test") {
        throw new Error(`${testKey} bukan issue type Test Xray.`);
      }
      await addTestToExecution(
        createJiraClient(base),
        base,
        key.trim().toUpperCase(),
        testKey,
      );
      setInput("");
      await load();
      onChanged();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Gagal menambahkan Test.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async (testKey: string) => {
    if (!window.confirm(`Remove ${testKey} dari Jira TE?`)) return;
    setBusy(true);
    try {
      const base = await getJiraBaseUrl();
      await removeTestFromExecution(
        createJiraClient(base),
        base,
        key.trim().toUpperCase(),
        testKey,
      );
      await load();
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal remove Test.");
    } finally {
      setBusy(false);
    }
  };
  const openDetail = async (item: (typeof items)[number]) => {
    const base = await getJiraBaseUrl();
    window.open(`${base}/browse/${encodeURIComponent(item.key)}`, "_blank");
  };
  return (
    <>
    <Card>
      <CardHeader>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-brand">
          Jira TE
        </p>
        <h2 className="mt-1 text-base font-black text-ink">
          Tambah / Hapus Test di Test Execution
        </h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input
            className={fieldClass}
            value={key}
            onChange={(event) => setKey(event.target.value.toUpperCase())}
            placeholder="PROJ-123"
          />
          <Button onClick={() => void load()} disabled={busy}>
            {busy ? "Loading..." : "Load"}
          </Button>
        </div>
        <div className="flex gap-2">
          <input
            className={fieldClass}
            value={input}
            onChange={(event) =>
              setInput(event.target.value.replace(/[^A-Za-z0-9-]/g, ""))
            }
            placeholder="Ticket Jira, contoh PROJ-456"
          />
          <Button onClick={() => void add()} disabled={busy || !input.trim()}>
            Add Test
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3">
          <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={items.length > 0 && selected.length === items.length} onChange={(event) => setSelected(event.target.checked ? items.map((item) => item.key) : [])} /> Select All</label>
          <span className="text-xs font-bold">Bulk Status ({selected.length})</span>
          <select className="h-9 rounded-lg border border-slate-300 px-2 text-xs" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option>PASS</option><option>TODO</option><option>EXECUTING</option><option>FAIL</option><option>ABORTED</option></select>
          <Button variant="outline" onClick={() => void updateBulkStatus()} disabled={busy || !selected.length}>Update Status</Button>
          {bulkResult && <p className="basis-full text-xs text-muted">{bulkResult}</p>}
        </div>
        <div className="overflow-auto rounded-xl border border-line">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Pilih</TableHead>
                <TableHead className="w-12">No.</TableHead>
                <TableHead className="w-28">Key</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="w-44">Assignee</TableHead>
                <TableHead className="w-36">Status Test TE</TableHead>
                <TableHead className="w-32">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length ? items.map((item, index) => (
                 <TableRow key={item.key}>
                    <TableCell><input type="checkbox" checked={selected.includes(item.key)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.key] : current.filter((selectedKey) => selectedKey !== item.key))} /></TableCell>
                    <TableCell className="font-bold">{index + 1}</TableCell>
                    <TableCell className="font-bold text-brand">{item.key}</TableCell>
                    <TableCell className="font-medium">{item.summary || "-"}</TableCell>
                    <TableCell>{item.assignee || "Unassigned"}</TableCell>
                    <TableCell><Badge variant={teStatusVariant(item.status)}>{item.status || "-"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1.5"><button className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold disabled:opacity-40" disabled={busy} onClick={() => void openDetail(item)}>Detail</button><button className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-bold disabled:opacity-40" disabled={busy} onClick={() => void remove(item.key)}>Remove</button></div>
                    </TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted">Load Jira Test Execution untuk menampilkan Test.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    <Dialog open={busy} title="" preventClose>
      <div className="flex flex-col items-center gap-4 py-5 text-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand" /><p className="text-sm font-semibold text-slate-600">Loading...</p></div>
    </Dialog>
    <Dialog open={Boolean(message)} title={message.startsWith("HTTP") || message.startsWith("Xray") || message.startsWith("Gagal") ? "Gagal" : "Berhasil"} onClose={() => setMessage("")}>
      <p className="text-sm text-slate-700">{message}</p>
      <div className="mt-5 flex justify-end"><Button onClick={() => setMessage("")}>OK</Button></div>
    </Dialog>
    </>
  );
}

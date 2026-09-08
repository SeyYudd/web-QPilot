import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function CompareController({
  pageId,
  executionKey,
  setPageId,
  setExecutionKey,
  onCompare,
  loading,
}: {
  pageId: string;
  executionKey: string;
  setPageId: (value: string) => void;
  setExecutionKey: (value: string) => void;
  onCompare: () => void;
  loading: boolean;
}) {
  return (
    <Card className="rounded-3xl border border-slate-200/80 bg-card shadow-sm">
      <CardContent className="space-y-4 p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-brand">
            Check &amp; Sync TE
          </p>
          <h2 className="mt-1 text-base font-black text-slate-800">
            Compare Jira TE &amp; Confluence
          </h2>
        </div>
        
        <label className="block text-xs font-bold text-slate-600">
          Confluence Page ID
          <input
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-card px-3 text-sm text-slate-700 outline-none transition focus:border-brand focus:ring-2 focus:ring-indigo-100"
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
            placeholder="6597588"
          />
        </label>

        <label className="block text-xs font-bold text-slate-600">
          Jira Test Execution Key
          <input
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-card px-3 text-sm uppercase text-slate-700 outline-none transition focus:border-brand focus:ring-2 focus:ring-indigo-100"
            value={executionKey}
            onChange={(event) => setExecutionKey(event.target.value.toUpperCase())}
            placeholder="OCOCWRAOUF-152"
          />
        </label>

        <Button 
          className="w-full rounded-xl bg-brand py-2.5 font-bold text-brand-foreground hover:bg-indigo-700 cursor-pointer"
          onClick={onCompare} 
          disabled={loading}
        >
          {loading ? "Comparing..." : "Compare"}
        </Button>
      </CardContent>
    </Card>
  );
}
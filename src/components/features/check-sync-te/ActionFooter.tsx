import { Button } from "@/components/ui/button";

export function ActionFooter({
  canFix,
  loading,
  onFix,
}: {
  canFix: boolean;
  loading: boolean;
  onFix: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">
        {canFix
          ? "Ada perbedaan urutan antara Jira TE dan Confluence."
          : "Tidak ada perbaikan posisi yang perlu dilakukan."}
      </p>
      <Button onClick={onFix} disabled={!canFix || loading}>
        {loading ? "Working..." : "Fix Position"}
      </Button>
    </div>
  );
}

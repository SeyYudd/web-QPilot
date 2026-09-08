import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComparisonResult } from "@/types";

const statusVariant = (status: string) =>
  status === "Match"
    ? "success"
    : status === "Urutan berbeda"
      ? "warning"
      : status === "Extra di Confluence"
        ? "destructive"
        : "neutral";

export function ComparisonTable({
  rows,
  onAdd,
  onRemove,
}: {
  rows: ComparisonResult[];
  onAdd: (row: ComparisonResult) => void;
  onRemove: (row: ComparisonResult) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-card shadow-xs">
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-slate-50/80">
            <TableRow className="border-b border-slate-200 hover:bg-transparent">
              <TableHead className="w-12 text-center text-xs font-semibold text-slate-600">NO</TableHead>
              <TableHead className="w-32 text-xs font-semibold text-slate-600">KEY</TableHead>
              <TableHead className="min-w-[220px] text-xs font-semibold text-slate-600">SCENARIO</TableHead>
              <TableHead className="w-24 text-xs font-semibold text-slate-600">POSISI</TableHead>
              <TableHead className="w-36 text-xs font-semibold text-slate-600">STATUS</TableHead>
              <TableHead className="w-32 text-xs font-semibold text-slate-600">TE STATUS</TableHead>
              <TableHead className="w-40 text-xs font-semibold text-slate-600">SCREEN CAPTURE</TableHead>
              <TableHead className="w-28 text-center text-xs font-semibold text-slate-600">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-xs text-slate-400">
                  Tidak ada data perbandingan.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key} className="border-b border-slate-100 transition-colors hover:bg-slate-50/60">
                  <TableCell className="text-center text-xs font-semibold text-slate-500">
                    {typeof row.order === "number" ? row.order : "-"}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-brand">
                    {row.key}
                  </TableCell>
                  {/* Scenario cell wrapping fix */}
                  <TableCell className="max-w-[280px] break-words whitespace-normal text-xs font-medium text-slate-800 leading-relaxed">
                    {row.positionTitle}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {row.position < 0 ? (
                      <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-500/10 ring-inset">
                        empty
                      </span>
                    ) : (
                      row.position + 1
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)} className="text-[11px] font-medium">
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {row.teStatus || "-"}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-slate-500" title={row.capture || undefined}>
                    {row.capture || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {row.status === "Missing di Confluence" && (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50/50 px-2.5 py-1 text-[11px] font-semibold text-brand transition-all hover:bg-brand hover:text-brand-foreground active:scale-95 cursor-pointer"
                          onClick={() => onAdd(row)}
                        >
                          Add
                        </button>
                      )}
                      {row.status === "Extra di Confluence" && (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition-all hover:bg-red-600 hover:text-white active:scale-95 cursor-pointer"
                          onClick={() => onRemove(row)}
                        >
                          Remove
                        </button>
                      )}
                      {row.status === "Match" && (
                        <span className="text-[11px] font-medium text-slate-400">
                          In sync
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
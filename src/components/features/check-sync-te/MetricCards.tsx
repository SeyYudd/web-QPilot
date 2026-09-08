import { Card, CardContent } from "@/components/ui/card";
import type { CompareSummary } from "@/types";

export function MetricCards({ summary }: { summary: CompareSummary }) {
  const metrics: Array<{ label: string; value: number; tone: string }> = [
    { label: "Jira TC", value: summary.jiraTotal, tone: "text-slate-700" },
    { label: "Match", value: summary.match, tone: "text-emerald-600" },
    { label: "Urutan berbeda", value: summary.differentOrder, tone: "text-amber-600" },
    { label: "Missing di Confluence", value: summary.missing, tone: "text-brand" },
    { label: "Extra di Confluence", value: summary.extra, tone: "text-red-600" },
    { label: "Has capture", value: summary.captured, tone: "text-slate-700" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {metrics.map((metric) => (
        <Card key={metric.label} size="sm">
          <CardContent>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {metric.label}
            </p>
            <p className={`mt-1 text-xl font-black ${metric.tone}`}>{metric.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

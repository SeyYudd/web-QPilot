export function LoadingOverlay({ open }: { open: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-lg">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand" />
        <p className="text-sm font-semibold text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

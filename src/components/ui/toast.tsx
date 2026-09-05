export function Toast({ message, tone }: { message: string; tone?: "info" | "success" | "error" }) {
  if (!message) return null;
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "info"
        ? "border-slate-200 bg-white text-slate-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div className={`fixed bottom-5 right-5 z-50 rounded-xl border px-4 py-3 text-xs font-bold shadow-lg ${toneClass}`} role="status">
      {message}
    </div>
  );
}

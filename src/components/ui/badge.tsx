import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "success" | "destructive" | "warning" | "neutral";
const variants: Record<Variant, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  destructive: "bg-red-50 text-red-700 ring-red-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({ className, variant = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-[10px] font-extrabold ring-1 ring-inset", variants[variant], className)} {...props} />;
}

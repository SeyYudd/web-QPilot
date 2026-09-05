import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function StatusDialog({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: "info" | "success" | "error";
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(message)}
      title={tone === "error" ? "Gagal" : tone === "success" ? "Berhasil" : "Info"}
      onClose={onClose}
    >
      <p className="text-sm text-slate-700">{message}</p>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>OK</Button>
      </div>
    </Dialog>
  );
}

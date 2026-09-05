import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} title={title} preventClose onClose={onClose}>
      {description && <p className="text-sm text-slate-500">{description}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>Yes</Button>
      </div>
    </Dialog>
  );
}

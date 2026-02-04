"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SubmitDeferralDialog(props: {
  disabled?: boolean;
  onSubmit: (payload: { workOrderNo: string; workOrderTitle: string }) => Promise<void>;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [workOrderNo, setWorkOrderNo] = useState("");
  const [workOrderTitle, setWorkOrderTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    setErr(null);
    if (!workOrderNo.trim()) {
      setErr("Work Order Number is required.");
      return;
    }

    setBusy(true);
    try {
      await props.onSubmit({
        workOrderNo: workOrderNo.trim(),
        workOrderTitle: workOrderTitle.trim(),
      });
      setOpen(false);
      setWorkOrderNo("");
      setWorkOrderTitle("");
    } catch (e: any) {
      setErr(e?.message ?? "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={props.disabled}>{props.triggerLabel ?? "Submit"}</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Submit Deferral</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workOrderNo">Work Order Number</Label>
            <Input
              id="workOrderNo"
              value={workOrderNo}
              onChange={(e) => setWorkOrderNo(e.target.value)}
              placeholder="e.g. WO-123456"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workOrderTitle">Work Order Title (optional)</Label>
            <Input
              id="workOrderTitle"
              value={workOrderTitle}
              onChange={(e) => setWorkOrderTitle(e.target.value)}
              placeholder="Short title for the work order"
            />
          </div>

          {err && <div className="text-sm text-destructive">{err}</div>}

          <div className="text-xs text-muted-foreground">
            After submission, the deferral enters the approval workflow and becomes read-only for most fields.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? "Submitting..." : "Confirm Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

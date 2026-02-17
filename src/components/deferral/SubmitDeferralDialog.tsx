"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SubmitDeferralDialog(props: {
  disabled?: boolean;

  /** If provided, the dialog will NOT ask again. It will submit using these values. */
  initialWorkOrderNo?: string;
  initialWorkOrderTitle?: string;

  /** Optional pre-submit validation. Return a list of missing fields to block opening the dialog. */
  validateBeforeOpen?: () => string[];
  onValidationFailed?: (missing: string[]) => void;

  onSubmit: (payload: {
    workOrderNo: string;
    workOrderTitle: string;
  }) => Promise<void>;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [workOrderNo, setWorkOrderNo] = useState("");
  const [workOrderTitle, setWorkOrderTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const presetNo = (props.initialWorkOrderNo ?? "").trim();
  const presetTitle = (props.initialWorkOrderTitle ?? "").trim();

  const willPromptForWorkOrder = useMemo(() => !presetNo, [presetNo]);

  async function handleSubmit() {
    setErr(null);

    const finalNo = (willPromptForWorkOrder ? workOrderNo : presetNo).trim();
    const finalTitle = (
      willPromptForWorkOrder ? workOrderTitle : presetTitle
    ).trim();

    if (!finalNo) {
      setErr("Work Order Number is required.");
      return;
    }

    setBusy(true);
    try {
      await props.onSubmit({
        workOrderNo: finalNo,
        workOrderTitle: finalTitle,
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
        <Button
          disabled={props.disabled || busy}
          onClick={(e) => {
            if (!props.validateBeforeOpen) return;
            const missing = props.validateBeforeOpen() ?? [];
            if (missing.length > 0) {
              e.preventDefault();
              e.stopPropagation();
              props.onValidationFailed?.(missing);
            }
          }}
        >
          {props.triggerLabel ?? "Submit"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Submit Deferral</DialogTitle>
        </DialogHeader>

        {willPromptForWorkOrder ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Work Order Number</Label>
              <Input
                placeholder="e.g. WO-123456"
                value={workOrderNo}
                onChange={(e) => setWorkOrderNo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Work Order Title (optional)</Label>
              <Input
                placeholder="Short title for the work order"
                value={workOrderTitle}
                onChange={(e) => setWorkOrderTitle(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border p-4 space-y-1">
            <div className="text-sm font-medium">Work Order Number</div>
            <div className="text-sm text-muted-foreground">{presetNo}</div>
            {presetTitle && (
              <>
                <div className="text-sm font-medium mt-3">Work Order Title</div>
                <div className="text-sm text-muted-foreground">
                  {presetTitle}
                </div>
              </>
            )}
            <div className="text-xs text-muted-foreground mt-3">
              Work order details are already saved on this deferral.
            </div>
          </div>
        )}

        {err && <div className="text-sm text-destructive mt-3">{err}</div>}

        <DialogFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
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

"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function DeferralActionDialogs({
  duplicateWarning,
  onCloseDuplicate,
  onConfirmDuplicate,
  showCloseDialog,
  onOpenCloseChange,
  onConfirmClose,
  showSoftDeleteDialog,
  onOpenSoftDeleteChange,
  deleteReason,
  setDeleteReason,
  onConfirmSoftDelete,
  showHardDeleteDialog,
  onOpenHardDeleteChange,
  onConfirmHardDelete,
}: {
  duplicateWarning: null | { duplicateRank: number; message: string };
  onCloseDuplicate: () => void;
  onConfirmDuplicate: () => void;
  showCloseDialog: boolean;
  onOpenCloseChange: (v: boolean) => void;
  onConfirmClose: () => void;
  showSoftDeleteDialog: boolean;
  onOpenSoftDeleteChange: (v: boolean) => void;
  deleteReason: string;
  setDeleteReason: (v: string) => void;
  onConfirmSoftDelete: () => void;
  showHardDeleteDialog: boolean;
  onOpenHardDeleteChange: (v: boolean) => void;
  onConfirmHardDelete: () => void;
}) {
  return (
    <>
      <AlertDialog
        open={!!duplicateWarning}
        onOpenChange={() => onCloseDuplicate()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate deferral warning</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateWarning?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDuplicate}>
              Continue submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCloseDialog} onOpenChange={onOpenCloseChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close deferral</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm closing this deferral after completion/job execution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmClose}>
              Close deferral
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showSoftDeleteDialog}
        onOpenChange={onOpenSoftDeleteChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete deferral with reason</AlertDialogTitle>
            <AlertDialogDescription>
              This will change the status to deleted and keep the record.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Enter reason for deleting this in-approval deferral"
              rows={4}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmSoftDelete}>
              Confirm delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showHardDeleteDialog}
        onOpenChange={onOpenHardDeleteChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft permanently</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the draft from the database permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmHardDelete}>
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

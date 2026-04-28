"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MitigationsEditor from "./mitigations-editor";
import { MitigationRow } from "./types";

type FormValues = {
  workOrderNo: string;
  workOrderTitle: string;
  equipmentTag: string;
  equipmentDescription: string;
  taskCriticality: string;
  safetyCriticality: string;
  originalLafd: string;
  lafdStartDate: string;
  lafdEndDate: string;
  description: string;
  justification: string;
  consequence: string;
};

export default function DeferralFormSections({
  form,
  setForm,
  mitigationRows,
  canEdit,
  onAddMitigation,
  onRemoveMitigation,
  onChangeMitigation,
  onSave,
  onSubmit,
  busy,
}: {
  form: FormValues;
  setForm: React.Dispatch<React.SetStateAction<FormValues>>;
  mitigationRows: MitigationRow[];
  canEdit: boolean;
  onAddMitigation: () => void;
  onRemoveMitigation: (index: number) => void;
  onChangeMitigation: (
    index: number,
    field: keyof MitigationRow,
    value: string,
  ) => void;
  onSave: () => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const update = (field: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Work Order No</Label>
          <Input
            value={form.workOrderNo}
            disabled={!canEdit}
            onChange={(e) => update("workOrderNo", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Work Order Title</Label>
          <Input
            value={form.workOrderTitle}
            disabled={!canEdit}
            onChange={(e) => update("workOrderTitle", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Equipment Full Code</Label>
          <Input
            value={form.equipmentTag}
            disabled={!canEdit}
            onChange={(e) => update("equipmentTag", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Equipment Description</Label>
          <Input
            value={form.equipmentDescription}
            disabled={!canEdit}
            onChange={(e) => update("equipmentDescription", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Task Criticality</Label>
          <Input
            value={form.taskCriticality}
            disabled={!canEdit}
            onChange={(e) => update("taskCriticality", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Safety Criticality</Label>
          <Input
            value={form.safetyCriticality}
            disabled={!canEdit}
            onChange={(e) => update("safetyCriticality", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Original LAFD</Label>
          <Input
            type="date"
            value={form.originalLafd}
            disabled={!canEdit}
            onChange={(e) => update("originalLafd", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Current LAFD</Label>
          <Input
            type="date"
            value={form.lafdStartDate}
            disabled={!canEdit}
            onChange={(e) => update("lafdStartDate", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>New LAFD</Label>
          <Input
            type="date"
            value={form.lafdEndDate}
            disabled={!canEdit}
            onChange={(e) => update("lafdEndDate", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          disabled={!canEdit}
          onChange={(e) => update("description", e.target.value)}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Justification</Label>
        <Textarea
          value={form.justification}
          disabled={!canEdit}
          onChange={(e) => update("justification", e.target.value)}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Consequence</Label>
        <Textarea
          value={form.consequence}
          disabled={!canEdit}
          onChange={(e) => update("consequence", e.target.value)}
          rows={4}
        />
      </div>

      <MitigationsEditor
        rows={mitigationRows}
        canEdit={canEdit}
        onAdd={onAddMitigation}
        onRemove={onRemoveMitigation}
        onChange={onChangeMitigation}
      />

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSave}
            disabled={busy}
          >
            Save
          </Button>
          <Button type="button" onClick={onSubmit} disabled={busy}>
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MitigationRow } from "./types";

export default function MitigationsEditor({
  rows,
  canEdit,
  onAdd,
  onRemove,
  onChange,
}: {
  rows: MitigationRow[];
  canEdit: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof MitigationRow, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label className="text-sm font-medium">Mitigations</Label>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onAdd}
          >
            Add mitigation
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.id ?? index}
            className="rounded-xl border p-4 space-y-3"
          >
            <div className="space-y-2">
              <Label>Required department</Label>
              <Input
                value={row.requiredDepartment}
                disabled={!canEdit}
                onChange={(e) =>
                  onChange(index, "requiredDepartment", e.target.value)
                }
                placeholder="e.g. Mechanical, Electrical, Operation"
              />
            </div>

            <div className="space-y-2">
              <Label>Mitigation action</Label>
              <Textarea
                value={row.mitigationText}
                disabled={!canEdit}
                onChange={(e) =>
                  onChange(index, "mitigationText", e.target.value)
                }
                placeholder="Describe this mitigation and its required action"
                rows={4}
              />
            </div>

            {canEdit && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => onRemove(index)}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

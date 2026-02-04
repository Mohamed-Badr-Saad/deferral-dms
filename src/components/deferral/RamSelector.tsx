"use client";

import { useMemo } from "react";
import { LIKELIHOOD_LEVELS, SEVERITY_LEVELS, computeRamCell, computeRamConsequence } from "@/src/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function RamSelector(props: {
  severity: number;
  likelihood: string;
  onChange: (next: { severity: number; likelihood: string; ramCell: string; ramConsequenceLevel: string }) => void;
}) {
  const ramCell = useMemo(() => computeRamCell(props.severity, props.likelihood), [props.severity, props.likelihood]);
  const consequence = useMemo(() => computeRamConsequence(props.severity, props.likelihood), [props.severity, props.likelihood]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <label className="text-sm font-medium">Severity</label>
          <Select
            value={String(props.severity)}
            onValueChange={(v) => {
              const sev = Number(v);
              props.onChange({
                severity: sev,
                likelihood: props.likelihood,
                ramCell: computeRamCell(sev, props.likelihood),
                ramConsequenceLevel: computeRamConsequence(sev, props.likelihood),
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select severity" />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_LEVELS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-44">
          <label className="text-sm font-medium">Likelihood</label>
          <Select
            value={props.likelihood}
            onValueChange={(v) => {
              const like = String(v);
              props.onChange({
                severity: props.severity,
                likelihood: like,
                ramCell: computeRamCell(props.severity, like),
                ramConsequenceLevel: computeRamConsequence(props.severity, like),
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select likelihood" />
            </SelectTrigger>
            <SelectContent>
              {LIKELIHOOD_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-6 flex items-center gap-2">
          <Badge variant="outline">RAM: {ramCell}</Badge>
          <Badge>{consequence}</Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Consequence is computed from a mock matrix in <code className="px-1">constants.ts</code>. You can replace it later with your final RAM rules.
      </p>
    </div>
  );
}

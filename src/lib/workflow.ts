import type { UserRole } from "@/src/lib/constants";

export type WorkflowDecision = {
  deferralNumber: 1 | 2 | 3;
  requiresTechnicalAuthority: boolean;
  requiresAdHoc: boolean;
  mitigationDepartments?: string[]; // ✅ mod #10 — unique departments from structured mitigations
};

export type StepTemplate = {
  stepOrder: number;
  stepRole: UserRole;
  requiresSignature: boolean;
  label: string;
  groupKey: string;
  targetDepartment?: string | null; // ✅ for mitigation DH steps
};

export function buildApprovalSteps(d: WorkflowDecision): StepTemplate[] {
  const steps: StepTemplate[] = [];
  let n = 1;

  // 1) Initiator's Department Head signs
  steps.push({
    stepOrder: n++,
    stepRole: "DEPARTMENT_HEAD",
    requiresSignature: true,
    label: "Department Head Signature",
    groupKey: "dept_head",
    targetDepartment: null, // set by caller to initiator's dept
  });

  // ✅ mod #10 — Mitigation Department Heads (parallel, before RE)
  const mitDepts = d.mitigationDepartments ?? [];
  if (mitDepts.length > 0) {
    const mitStepOrder = n++;
    for (const dept of mitDepts) {
      steps.push({
        stepOrder: mitStepOrder,
        stepRole: "DEPARTMENT_HEAD",
        requiresSignature: true,
        label: `Mitigation Department Head Signature (${dept})`,
        groupKey: "mitigation_dept_heads",
        targetDepartment: dept,
      });
    }
  }

  // 2) Reliability Engineer review
  steps.push({
    stepOrder: n++,
    stepRole: "RELIABILITY_ENGINEER",
    requiresSignature: false,
    label: "Reliability Engineer Review",
    groupKey: "re_review",
    targetDepartment: null,
  });

  // 3) Reliability GM
  steps.push({
    stepOrder: n++,
    stepRole: "RELIABILITY_GM",
    requiresSignature: true,
    label: "Reliability GM Approval & Signature",
    groupKey: "re_gm",
    targetDepartment: null,
  });

  // 4) Optional TA
  if (d.requiresTechnicalAuthority) {
    steps.push({
      stepOrder: n++,
      stepRole: "TECHNICAL_AUTHORITY",
      requiresSignature: true,
      label: "Technical Authority Signature",
      groupKey: "ta",
      targetDepartment: null,
    });
  }

  // 5) Optional AD HOC
  if (d.requiresAdHoc) {
    steps.push({
      stepOrder: n++,
      stepRole: "AD_HOC",
      requiresSignature: true,
      label: "AD HOC Signature",
      groupKey: "adhoc",
      targetDepartment: null,
    });
  }

  // 6) Responsible segment
  if (d.deferralNumber === 1) {
    steps.push({
      stepOrder: n++,
      stepRole: "RESPONSIBLE_GM",
      requiresSignature: true,
      label: "Responsible GM Signature",
      groupKey: "resp_single",
      targetDepartment: null,
    });
  } else {
    const groupKey = "resp_parallel";
    const stepOrder = n++;
    steps.push({
      stepOrder,
      stepRole: "RESPONSIBLE_GM",
      requiresSignature: true,
      label: "Responsible GM Signature",
      groupKey,
      targetDepartment: null,
    });
    steps.push({
      stepOrder,
      stepRole: "SOD",
      requiresSignature: true,
      label: "SOD Signature",
      groupKey,
      targetDepartment: null,
    });
    steps.push({
      stepOrder,
      stepRole: "DFGM",
      requiresSignature: true,
      label: "DFGM Signature",
      groupKey,
      targetDepartment: null,
    });
  }

  // 7) Planning Engineer
  steps.push({
    stepOrder: n++,
    stepRole: "PLANNING_ENGINEER",
    requiresSignature: true,
    label: "Planning Engineer (GMS Integration) Signature",
    groupKey: "planning",
    targetDepartment: null,
  });

  // 8) Planning Supervisor
  steps.push({
    stepOrder: n++,
    stepRole: "PLANNING_SUPERVISOR_ENGINEER",
    requiresSignature: true,
    label: "Planning Supervisor Signature",
    groupKey: "planning_supervisor",
    targetDepartment: null,
  });

  return steps;
}

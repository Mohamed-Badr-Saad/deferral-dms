import type { UserRole } from "@/src/lib/constants";

export type WorkflowDecision = {
  deferralNumber: 1 | 2 | 3;
  requiresTechnicalAuthority: boolean;
  requiresAdHoc: boolean;
};

export type StepTemplate = {
  stepOrder: number;
  stepRole: UserRole;
  requiresSignature: boolean;
  label: string;

  // approvals with same (stepOrder + groupKey) are parallel and must all finish
  // NOTE: we are not storing groupKey in DB right now; stepOrder alone enables parallel behavior.
  groupKey: string;
};

export function buildApprovalSteps(d: WorkflowDecision): StepTemplate[] {
  const steps: StepTemplate[] = [];
  let n = 1;

  // 1) Department Head signs
  steps.push({
    stepOrder: n++,
    stepRole: "DEPARTMENT_HEAD",
    requiresSignature: true,
    label: "Department Head Signature",
    groupKey: "dept_head",
  });

  // 2) Reliability Engineer review only (no signature required)
  steps.push({
    stepOrder: n++,
    stepRole: "RELIABILITY_ENGINEER",
    requiresSignature: false,
    label: "Reliability Engineer Review",
    groupKey: "re_review",
  });

  // 3) Reliability GM signs (ALWAYS before TA/ADHOC and before parallel/planning)
  steps.push({
    stepOrder: n++,
    stepRole: "RELIABILITY_GM",
    requiresSignature: true,
    label: "Reliability GM Approval & Signature",
    groupKey: "re_gm",
  });

  // 4) Optional steps MUST happen after Reliability GM signature
  // and BEFORE Responsible segment + planning
  if (d.requiresTechnicalAuthority) {
    steps.push({
      stepOrder: n++,
      stepRole: "TECHNICAL_AUTHORITY",
      requiresSignature: true,
      label: "Technical Authority Signature",
      groupKey: "ta",
    });
  }

  if (d.requiresAdHoc) {
    steps.push({
      stepOrder: n++,
      stepRole: "AD_HOC",
      requiresSignature: true,
      label: "AD HOC Signature",
      groupKey: "adhoc",
    });
  }

  // 5) Responsible segment:
  // deferral #1 => Responsible GM only (single)
  // deferral #2/#3 => Responsible GM + SOD + DFGM (parallel group at same stepOrder)
  if (d.deferralNumber === 1) {
    steps.push({
      stepOrder: n++,
      stepRole: "RESPONSIBLE_GM",
      requiresSignature: true,
      label: "Responsible GM Signature",
      groupKey: "resp_single",
    });
  } else {
    // parallel block
    const groupKey = "resp_parallel";
    const stepOrder = n++;

    steps.push({
      stepOrder,
      stepRole: "RESPONSIBLE_GM",
      requiresSignature: true,
      label: "Responsible GM Signature",
      groupKey,
    });

    steps.push({
      stepOrder,
      stepRole: "SOD",
      requiresSignature: true,
      label: "SOD Signature",
      groupKey,
    });

    steps.push({
      stepOrder,
      stepRole: "DFGM",
      requiresSignature: true,
      label: "DFGM Signature",
      groupKey,
    });
  }

  // 6) Planning Engineer signs after Responsible segment is complete
  steps.push({
    stepOrder: n++,
    stepRole: "PLANNING_ENGINEER",
    requiresSignature: true,
    label: "Planning Engineer (GMS Integration) Signature",
    groupKey: "planning",
  });

  // 7) Planning Supervisor signs last
  steps.push({
    stepOrder: n++,
    stepRole: "PLANNING_SUPERVISOR_ENGINEER",
    requiresSignature: true,
    label: "Planning Supervisor Signature",
    groupKey: "planning_supervisor",
  });

  return steps;
}


function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export function validateLafdWindow(
  lafdStart: Date | null,
  lafdEnd: Date | null,
) {
  if (!lafdStart || !lafdEnd) return null;

  const max = addMonths(lafdStart, 6);
  if (lafdEnd.getTime() > max.getTime()) {
    return "Maximum deferred period is 6 months from Current LAFD.";
  }
  if (lafdEnd.getTime() < lafdStart.getTime()) {
    return "Deferred To (New LAFD) cannot be earlier than Current LAFD.";
  }
  return null;
}

export function addDaysIso(dateIso: string, days: number) {
  // dateIso is yyyy-mm-dd
  const d = new Date(dateIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const STEP_ROLE_LABELS: Record<string, string> = {
  ENGINEER_APPLICANT: "Engineer (Applicant)",
  DEPARTMENT_HEAD: "Department Head",
  RELIABILITY_ENGINEER: "Reliability Engineer",
  RELIABILITY_GM: "Reliability GM",
  RESPONSIBLE_GM: "Responsible GM",
  SOD: "SOD",
  DFGM: "DFGM",
  TECHNICAL_AUTHORITY: "Technical Authority",
  AD_HOC: "AD HOC",
  PLANNING_ENGINEER: "Planning Engineer (GMS Integration)",
  PLANNING_SUPERVISOR_ENGINEER: "Planning Supervisor Engineer",
  ADMIN: "Admin",
};

export function formatStepRole(role: string): string {
  return (
    STEP_ROLE_LABELS[role] ??
    role
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}




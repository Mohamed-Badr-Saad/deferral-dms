export const USER_ROLES = [
  "ENGINEER_APPLICANT",
  "DEPARTMENT_HEAD",
  "RELIABILITY_ENGINEER",
  "RELIABILITY_GM",
  "RESPONSIBLE_GM",
  "SOD",
  "DFGM",
  "TECHNICAL_AUTHORITY",
  "AD_HOC",
  "PLANNING_ENGINEER",
  "PLANNING_SUPERVISOR_ENGINEER",
  "ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
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

export const DEFERRAL_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "IN_APPROVAL",
  "REJECTED",
  "APPROVED",
  "COMPLETED",
] as const;

export type DeferralStatus = (typeof DEFERRAL_STATUS)[number];

export const STATUS_LABELS: Record<DeferralStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  RETURNED: "Returned",
  IN_APPROVAL: "In Approval",
  REJECTED: "Rejected",
  APPROVED: "Approved",
  COMPLETED: "Completed",
};

export const STATUS_COLORS: Record<DeferralStatus, string> = {
  DRAFT: "bg-muted text-foreground",
  RETURNED: "bg-red-100 text-foreground",
  SUBMITTED: "bg-blue-100 text-blue-900",
  IN_APPROVAL: "bg-amber-100 text-amber-900",
  REJECTED: "bg-red-300 text-red-900",
  APPROVED: "bg-green-100 text-green-900",
  COMPLETED: "bg-green-400 text-emerald-900",
};

export const RISK_CATEGORIES = ["PEOPLE", "ENVIRONMENT", "FINANCIAL", "REPUTATION"] as const;

export const SEVERITY_LEVELS = [1, 2, 3, 4, 5] as const;
export const LIKELIHOOD_LEVELS = ["A", "B", "C", "D", "E"] as const;

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE ?? 5242880);



export const RAM_CONSEQUENCE_LEVELS = ["Slight", "Minor", "Moderate", "Major", "Massive"] as const;
export type RamConsequenceLevel = (typeof RAM_CONSEQUENCE_LEVELS)[number];

// Mock consequence matrix (you will adjust later):
// Indexed by severity 1..5 and likelihood A..E
export const RAM_CONSEQUENCE_MATRIX: Record<number, Record<string, RamConsequenceLevel>> = {
  1: { A: "Slight",   B: "Slight",   C: "Minor",    D: "Minor",    E: "Moderate" },
  2: { A: "Slight",   B: "Minor",    C: "Minor",    D: "Moderate", E: "Major" },
  3: { A: "Minor",    B: "Minor",    C: "Moderate", D: "Major",    E: "Major" },
  4: { A: "Minor",    B: "Moderate", C: "Major",    D: "Major",    E: "Massive" },
  5: { A: "Moderate", B: "Major",    C: "Major",    D: "Massive",  E: "Massive" },
};

export function computeRamCell(severity: number, likelihood: string) {
  return `${severity}${likelihood}`; // e.g. 3C
}

export function computeRamConsequence(severity: number, likelihood: string): RamConsequenceLevel {
  const s = Math.min(5, Math.max(1, Number(severity))) as 1 | 2 | 3 | 4 | 5;
  const l = String(likelihood ?? "A").toUpperCase();
  return RAM_CONSEQUENCE_MATRIX[s]?.[l] ?? "Slight";
}

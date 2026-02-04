export const GM_GROUPS = [
  "MAINTENANCE_GM",
  "FACILITY_SUPPORT_GM",
  "SUBSEA_CONTROL_GM",
  "PRODUCTION_GM",
] as const;

export type GmGroup = (typeof GM_GROUPS)[number];

function norm(s: string) {
  return (s ?? "").trim().toLowerCase();
}

export function gmGroupForDepartment(dept: string): GmGroup {
  const d = norm(dept);

  // Maintenance GM
  if (
    [
      "electrical",
      "mechanical",
      "instrument",
      "turbo",
      "civil",
      "hvac",
      "telecom",
    ].includes(d)
  ) {
    return "MAINTENANCE_GM";
  }

  // Facility support GM
  if (["condition monitoring", "inspection", "painting"].includes(d)) {
    return "FACILITY_SUPPORT_GM";
  }

  // Subsea control GM
  if (["subsea control", "subsea_control"].includes(d)) {
    return "SUBSEA_CONTROL_GM";
  }

  // Production GM
  if (["production"].includes(d)) {
    return "PRODUCTION_GM";
  }

  // Default (choose what you prefer)
  return "MAINTENANCE_GM";
}

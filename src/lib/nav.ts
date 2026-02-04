import type { UserRole } from "@/src/lib/constants";

export type NavItem = {
  label: string;
  href: string;
  roles?: UserRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },

  // Deferrals
  { label: "Deferrals", href: "/deferrals" },
  { label: "Deferrals (History)", href: "/deferrals?scope=history" },

  // Approvals list (for reviewers/signers)
  { label: "Approvals", href: "/approvals", roles: ["DEPARTMENT_HEAD", "RELIABILITY_ENGINEER", "RELIABILITY_GM", "RESPONSIBLE_GM", "SOD", "DFGM", "TECHNICAL_AUTHORITY", "AD_HOC", "PLANNING_ENGINEER", "PLANNING_SUPERVISOR_ENGINEER", "ADMIN"] },

  // Admin (only admin)
  { label: "Admin", href: "/admin", roles: ["ADMIN"] },
];

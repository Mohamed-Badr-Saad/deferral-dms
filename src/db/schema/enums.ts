import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
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
]);

export const gmGroupEnum = pgEnum("gm_group", [
  "MAINTENANCE_GM",
  "FACILITY_SUPPORT_GM",
  "SUBSEA_CONTROL_GM",
  "PRODUCTION_GM",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SKIPPED",
]);

export const deferralStatusEnum = pgEnum("deferral_status", [
  "DRAFT",
  "SUBMITTED",
  "IN_APPROVAL",
  "REJECTED",
  "APPROVED",
  "COMPLETED",
]);

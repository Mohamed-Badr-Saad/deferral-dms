import { pgTable, uuid, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { deferralStatusEnum } from "./enums";

export const deferrals = pgTable("deferrals", {
  id: uuid("id").primaryKey(),

  deferralCode: text("deferral_code").notNull().unique(),

  initiatorUserId: uuid("initiator_user_id").notNull(), // references users.id (we’ll add FK later if you want)
  initiatorDepartment: text("initiator_department").notNull(),
  workOrderNo: text("work_order_no").notNull().default(""),
  workOrderTitle: text("work_order_title").notNull().default(""),

  equipmentTag: text("equipment_tag").notNull().default(""),
  equipmentDescription: text("equipment_description").notNull().default(""),

  taskCriticality: text("task_criticality").notNull().default(""),
  safetyCriticality: text("safety_criticality").notNull().default(""),

  // LAFD dates (we’ll refine types later if needed)
  lafdStartDate: timestamp("lafd_start_date", { withTimezone: true }),
  lafdEndDate: timestamp("lafd_end_date", { withTimezone: true }),

  description: text("description").notNull().default(""),
  justification: text("justification").notNull().default(""),
  consequence: text("consequence").notNull().default(""),

  // Risk assessment (structured)
  riskCategory: text("risk_category").notNull().default(""), // PEOPLE/ENV/FIN/REP (we can enforce later)
  severity: integer("severity").notNull().default(1), // 1..5
  likelihood: text("likelihood").notNull().default("A"), // A..E
  ramCell: text("ram_cell").notNull().default("1A"), // computed like "3D"
  ramConsequenceLevel: text("ram_consequence_level").notNull().default(""), // e.g. Minor/Major etc.

  mitigations: text("mitigations").notNull().default(""),

  // Reliability GM decision flags
  requiresTechnicalAuthority: boolean("requires_technical_authority").notNull().default(false),
  requiresAdHoc: boolean("requires_ad_hoc").notNull().default(false),

  status: deferralStatusEnum("status").notNull().default("DRAFT"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

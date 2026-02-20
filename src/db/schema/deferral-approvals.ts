import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { approvalStatusEnum } from "./enums";
import { gmGroupEnum } from "./enums";
export const deferralApprovals = pgTable("deferral_approvals", {
  id: uuid("id").primaryKey(),
  deferralId: uuid("deferral_id").notNull(),

  stepOrder: integer("step_order").notNull(),
  stepRole: text("step_role").notNull(),

 // ✅ new: approvals cycle
  cycle: integer("cycle").notNull().default(0),
  
  status: approvalStatusEnum("status").notNull().default("PENDING"),

  comment: text("comment").notNull().default(""),
  isActive: boolean("is_active").notNull().default(false),

    // broadcast/assignment
  assignedUserId: uuid("assigned_user_id"), // nullable
  targetDepartment: text("target_department"),
  targetGmGroup: gmGroupEnum("target_gm_group"),
  
  // signature snapshots
  signedByUserId: uuid("signed_by_user_id"),
  signatureUrlSnapshot: text("signature_url_snapshot").notNull().default(""),
  signedByNameSnapshot: text("signed_by_name_snapshot").notNull().default(""),
  signedAt: timestamp("signed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

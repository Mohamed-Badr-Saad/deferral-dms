import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const deferralMitigations = pgTable("deferral_mitigations", {
  id: uuid("id").primaryKey(),
  deferralId: uuid("deferral_id").notNull(),
  description: text("description").notNull().default(""),
  requiredDepartment: text("required_department").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

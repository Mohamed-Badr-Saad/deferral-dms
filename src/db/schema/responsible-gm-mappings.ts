import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { gmGroupEnum } from "./enums";

export const responsibleGmMappings = pgTable("responsible_gm_mappings", {
  id: uuid("id").primaryKey(),

  department: text("department").notNull().unique(), // e.g. Electrical, Mechanical, etc.
  gmGroup: gmGroupEnum("gm_group").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const gmGroupEnum = pgEnum("gm_group", [
  "MAINTENANCE_GM",
  "FACILITY_SUPPORT_GM",
  "SUBSEA_CONTROL_GM",
  "PRODUCTION_GM",
] as const);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  position: text("position").notNull(),
  role: text("role").notNull(),

  // ✅ THIS is what we need:
  gmGroup: gmGroupEnum("gm_group"), // nullable (only needed for RESPONSIBLE_GM users)

  signatureUrl: text("signature_url"),
  signatureUploadedAt: timestamp("signature_uploaded_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey(),

  userId: uuid("user_id").notNull(),
  deferralId: uuid("deferral_id"),

  title: text("title").notNull(),
  body: text("body").notNull().default(""),

  // ✅ add snapshots
  deferralCodeSnapshot: text("deferral_code_snapshot"),
  equipmentTagSnapshot: text("equipment_tag_snapshot"),

  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

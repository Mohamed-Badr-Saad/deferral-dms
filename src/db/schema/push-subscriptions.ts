import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

// One row per browser/device subscription. A user can have several (phone,
// laptop, multiple browsers); each is pushed to independently and pruned
// automatically when the browser reports it gone (404/410 from the push
// service).
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey(),

  userId: uuid("user_id").notNull(),

  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),

  userAgent: text("user_agent"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

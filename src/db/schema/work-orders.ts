import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const workOrders = pgTable("work_orders", {
  id: uuid("id").primaryKey(),
  workOrderNo: text("work_order_no").notNull().unique(), // e.g. WO number
  title: text("title").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

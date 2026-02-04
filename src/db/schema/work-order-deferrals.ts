import { pgTable, uuid, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const workOrderDeferrals = pgTable(
  "work_order_deferrals",
  {
    id: uuid("id").primaryKey(),
    workOrderId: uuid("work_order_id").notNull(),
    deferralId: uuid("deferral_id").notNull(),

    // must be 1..3 (we enforce via app validation + later DB check constraint)
    deferralNumber: integer("deferral_number").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqWoNumber: uniqueIndex("uniq_work_order_deferral_number").on(
      t.workOrderId,
      t.deferralNumber
    ),
    uniqDeferral: uniqueIndex("uniq_work_order_deferral_deferral").on(t.deferralId),
  })
);

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const deferralRiskCategoryEnum = pgEnum("deferral_risk_category", [
  "PEOPLE",
  "ASSET",
  "ENVIRONMENT",
  "REPUTATION",
] as const);

export const deferralRisks = pgTable(
  "deferral_risks",
  {
    id: uuid("id").primaryKey(),
    deferralId: uuid("deferral_id").notNull(),
    category: deferralRiskCategoryEnum("category").notNull(),

    severity: integer("severity").notNull().default(1),
    likelihood: text("likelihood").notNull().default("A"),

    ramCell: text("ram_cell").notNull().default("1A"),
    ramConsequenceLevel: text("ram_consequence_level").notNull().default(""),

    justification: text("justification").notNull().default(""),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("deferral_risks_unique_deferral_category").on(
      t.deferralId,
      t.category,
    ),
  }),
);

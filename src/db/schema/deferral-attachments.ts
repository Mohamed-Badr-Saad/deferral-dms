import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const deferralAttachments = pgTable("deferral_attachments", {
  id: uuid("id").primaryKey(),

  deferralId: uuid("deferral_id").notNull(),

  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(), // INTEGER (critical)
  filePath: text("file_path").notNull(),

  uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

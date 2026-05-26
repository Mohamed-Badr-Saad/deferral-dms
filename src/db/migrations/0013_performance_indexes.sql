CREATE INDEX IF NOT EXISTS "idx_deferrals_status_updated_at" ON "deferrals" USING btree ("status", "updated_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deferrals_department_status_updated_at" ON "deferrals" USING btree ("initiator_department", "status", "updated_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deferrals_lafd_status" ON "deferrals" USING btree ("lafd_end_date", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deferrals_updated_id" ON "deferrals" USING btree ("updated_at" DESC, "id" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_work_order_deferrals_rank_deferral" ON "work_order_deferrals" USING btree ("deferral_number", "deferral_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deferral_approvals_active_step" ON "deferral_approvals" USING btree ("deferral_id", "cycle", "is_active", "step_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deferral_approvals_pending_step" ON "deferral_approvals" USING btree ("deferral_id", "cycle", "status", "step_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_deferral_approvals_user_history" ON "deferral_approvals" USING btree ("signed_by_user_id", "status", "signed_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user_created_at" ON "notifications" USING btree ("user_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications" USING btree ("user_id", "is_read");

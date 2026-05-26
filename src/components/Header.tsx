"use client";

import { UserMenu } from "@/src/components/UserMenu";
import { NotificationsBell } from "@/src/components/NotificationsBell";
import { MobileSidebar } from "@/src/components/Sidebar";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MobileSidebar />
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-sm font-semibold tracking-tight">
              Deferral Management System
            </div>

          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationsBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

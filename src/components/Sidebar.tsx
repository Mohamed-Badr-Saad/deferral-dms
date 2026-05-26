"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/src/lib/nav";
import { useProfile } from "@/src/hooks/useProfile";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import { Menu } from "lucide-react";

function isActiveLink(
  currentPath: string,
  currentScope: string | null,
  href: string,
) {
  if (!href.includes("?")) return currentPath === href;

  const [path, qs] = href.split("?");
  if (currentPath !== path) return false;

  const params = new URLSearchParams(qs);
  const hrefScope = params.get("scope");
  return (hrefScope ?? "") === (currentScope ?? "");
}

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r bg-background/70 backdrop-blur md:block">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SidebarContent closeLinks />
      </SheetContent>
    </Sheet>
  );
}

function SidebarContent({ closeLinks = false }: { closeLinks?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope");

  const { profile, loading } = useProfile();
  const role = profile?.role;

  const items = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (!role) return false;
    return item.roles.includes(role);
  });

  const wrapLink = (children: React.ReactNode) =>
    closeLinks ? <SheetClose asChild>{children}</SheetClose> : children;

  return (
    <div className="flex h-full min-h-dvh flex-col bg-background/95">
      {/* Brand */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl ">
            <Image
              src={"/Rashid-icon.ico"}
              alt="Rashid Logo"
              width={40}
              height={30}
              className="absolute"
            />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Deferral DMS
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Deferral Management System
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {items.map((item) => {
            const active = isActiveLink(pathname, scope, item.href);
            return (
              <div key={item.href}>
                {wrapLink(
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>,
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <Separator />

      {/* User preview */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading user…</div>
        ) : (
          <div className="space-y-1">
            <div className="text-sm font-semibold leading-none">
              {profile?.name ?? "Unknown user"}
            </div>
            <div className="text-xs text-muted-foreground">
              {profile?.department ?? "-"} • {profile?.role ?? "-"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

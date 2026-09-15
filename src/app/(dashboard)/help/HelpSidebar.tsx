"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type HelpNavGroup = {
  label: string;
  items: { id: string; label: string }[];
};

/**
 * Sticky in-page table of contents. Highlights whichever section is
 * currently in view (via IntersectionObserver) so the guide reads like a
 * proper documentation site rather than a flat page of anchors.
 */
export function HelpSidebar({ groups }: { groups: HelpNavGroup[] }) {
  const allIds = groups.flatMap((g) => g.items.map((i) => i.id));
  const [activeId, setActiveId] = useState<string>(allIds[0] ?? "");

  useEffect(() => {
    const elements = allIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav className="hidden lg:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </p>
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-primary/70">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={cn(
                        "block rounded-md border-l-2 px-3 py-1.5 text-[13px] leading-snug transition-colors",
                        activeId === item.id
                          ? "border-primary bg-primary/5 font-medium text-primary"
                          : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BackToTopButton({ targetId = "top" }: { targetId?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function getScrollableElements() {
      return Array.from(document.querySelectorAll<HTMLElement>("*")).filter(
        (el) => el.scrollHeight > el.clientHeight + 8,
      );
    }

    function getScrollTop() {
      return Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        document.body.scrollTop,
        document.scrollingElement?.scrollTop ?? 0,
        ...getScrollableElements().map((el) => el.scrollTop),
      );
    }

    function updateVisibility() {
      setVisible(getScrollTop() > 80);
    }

    updateVisibility();
    const timer = window.setInterval(updateVisibility, 250);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    document.addEventListener("scroll", updateVisibility, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", updateVisibility);
      document.removeEventListener("scroll", updateVisibility, {
        capture: true,
      });
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  function scrollToTop() {
    const target = document.getElementById(targetId);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
    document.body.scrollTo({ top: 0, behavior: "smooth" });
    document.scrollingElement?.scrollTo({ top: 0, behavior: "smooth" });
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <Button
      type="button"
      size="icon"
      aria-label="Back to top"
      title="Back to top"
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-6 right-6 z-[9999] h-12 w-12 rounded-full border border-white/30 bg-primary text-primary-foreground shadow-xl transition-all duration-200 hover:bg-primary/90",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="size-6" />
    </Button>
  );
}

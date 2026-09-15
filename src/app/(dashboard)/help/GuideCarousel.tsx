"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type GuideSlide = {
  src: string;
  alt: string;
  caption?: string;
};

/**
 * A small dependency-free image carousel for a sequence of user-guide
 * screenshots (e.g. the steps of creating a deferral). Falls back to a
 * "not added yet" placeholder per-slide if a given file is missing, the
 * same way GuideImage does for a single screenshot.
 */
export function GuideCarousel({
  slides,
  aspect = "16 / 10",
}: {
  slides: GuideSlide[];
  aspect?: string;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  if (slides.length === 0) return null;

  const current = slides[index];
  const fileName = current.src.split("/").pop();
  const go = (dir: 1 | -1) =>
    setIndex((i) => (i + dir + slides.length) % slides.length);

  return (
    <div className="space-y-2">
      <div
        className="group relative overflow-hidden rounded-xl border bg-muted/20 shadow-sm"
        style={{ aspectRatio: aspect }}
      >
        {failed[index] ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 border-2 border-dashed border-muted-foreground/25 px-6 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Screenshot not added yet
              </p>
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                Expected file:{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  {fileName}
                </code>
              </p>
            </div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.src}
            alt={current.alt}
            className="h-full w-full object-contain bg-white"
            onError={() =>
              setFailed((prev) => ({ ...prev, [index]: true }))
            }
          />
        )}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous screenshot"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next screenshot"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-background/80 px-2 py-1 shadow-sm">
              {slides.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  aria-label={`Go to screenshot ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/40",
                  )}
                />
              ))}
            </div>
            <div className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
              {index + 1} / {slides.length}
            </div>
          </>
        )}
      </div>
      {current.caption && (
        <p className="text-xs text-muted-foreground">{current.caption}</p>
      )}
    </div>
  );
}

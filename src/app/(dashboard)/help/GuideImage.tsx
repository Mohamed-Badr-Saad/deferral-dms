"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

/**
 * Renders a user-guide screenshot from /public/user-guide/. Until that file
 * actually exists (screenshots are captured and dropped in by hand — see
 * public/user-guide/README.md), this shows a clean, clearly labeled
 * placeholder instead of a broken-image icon, so the page still looks
 * intentional and professional before every screenshot has been added.
 */
export function GuideImage({
  src,
  alt,
  caption,
  aspect = "16 / 10",
}: {
  src: string;
  alt: string;
  caption?: string;
  aspect?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fileName = src.split("/").pop();

  return (
    <figure className="space-y-2">
      <div
        className="overflow-hidden rounded-xl border bg-muted/20 shadow-sm"
        style={{ aspectRatio: failed ? aspect : undefined }}
      >
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 border-2 border-dashed border-muted-foreground/25 px-6 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Screenshot not added yet
              </p>
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                Save an image as{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  {fileName}
                </code>{" "}
                in <span className="font-mono text-[10px]">public/user-guide/</span>
              </p>
            </div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {caption && (
        <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  );
}

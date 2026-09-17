"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, ZoomIn } from "lucide-react";
import { ImageLightbox } from "./ImageLightbox";

/**
 * Renders a user-guide screenshot from /public/user-guide/. Until that file
 * actually exists (screenshots are captured and dropped in by hand — see
 * public/user-guide/README.md), this shows a clean, clearly labeled
 * placeholder instead of a broken-image icon, so the page still looks
 * intentional and professional before every screenshot has been added.
 *
 * Clicking the image opens it in a full-screen lightbox for a larger view.
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileName = src.split("/").pop();

  // The browser starts loading <img> tags during the initial HTML parse,
  // before React hydrates and attaches onError below. If the image 404s
  // in that window, the error event fires and is gone before our handler
  // exists, so onError alone never runs and a raw broken-image icon shows
  // instead of the placeholder. Checking img.complete/naturalWidth once
  // mounted catches that case too.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed(true);
    }
  }, [src]);

  return (
    <figure className="space-y-2">
      <div
        className="group relative overflow-hidden rounded-xl border bg-muted/20 shadow-sm"
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
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              onClick={() => setLightboxOpen(true)}
              className="h-full w-full cursor-zoom-in object-cover"
              onError={() => setFailed(true)}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow">
                <ZoomIn className="h-4 w-4" />
              </span>
            </div>
          </>
        )}
      </div>
      {caption && (
        <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
      )}

      {lightboxOpen && !failed && (
        <ImageLightbox
          src={src}
          alt={alt}
          caption={caption}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </figure>
  );
}

"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Renders a user-guide screenshot from /public/user-guide/. Until that file
 * actually exists (the screenshots are meant to be captured and dropped in
 * by hand — see public/user-guide/README.md), this shows a clearly labeled
 * placeholder instead of a broken-image icon, so the Help page still looks
 * intentional before every screenshot has been added.
 */
export function GuideImage({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="space-y-2">
      <div className="overflow-hidden rounded-lg border bg-muted/30">
        {failed ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-xs text-muted-foreground">
            <ImageOff className="h-5 w-5" />
            <span>
              Screenshot not added yet.
              <br />
              Save an image as <code className="rounded bg-muted px-1 py-0.5">{src}</code> in
              the app's public folder.
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className="w-full object-contain"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {caption && (
        <figcaption className="text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

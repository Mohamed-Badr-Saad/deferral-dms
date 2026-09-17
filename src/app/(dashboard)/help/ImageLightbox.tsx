"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Full-screen preview for a user-guide screenshot. Opened by clicking a
 * GuideImage or the current slide of a GuideCarousel. Rendered via a portal
 * into document.body so it always sits above everything else regardless of
 * where it's triggered from.
 */
export function ImageLightbox({
  src,
  alt,
  caption,
  counter,
  onClose,
  onPrev,
  onNext,
}: {
  src: string;
  alt: string;
  caption?: string;
  counter?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrev, onNext]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-5 sm:top-5"
      >
        <X className="h-5 w-5" />
      </button>

      {onPrev && (
        <button
          type="button"
          aria-label="Previous screenshot"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-5"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          aria-label="Next screenshot"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-5"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />
        {(caption || counter) && (
          <div className="flex items-center gap-3 text-center text-sm text-white/80">
            {caption && <span>{caption}</span>}
            {counter && <span className="text-white/50">{counter}</span>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

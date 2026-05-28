"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { RefreshCw, RotateCcw, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cropImageToBlob } from "@/src/lib/image-crop";

type Area = { x: number; y: number; width: number; height: number };

const DEFAULT_CROP = { x: 0, y: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapRotation(value: number) {
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function AdjustmentControl(props: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{props.label}</div>
        <div className="text-xs text-muted-foreground">{props.value}</div>
      </div>
      {props.children}
    </div>
  );
}

export function SignatureCropDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imageSrc: string;
  onCropped: (blob: Blob) => Promise<void>;
}) {
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const cropOptions = useMemo(
    () => ({ rotation, brightness, contrast }),
    [rotation, brightness, contrast],
  );

  const imageFilter = useMemo(
    () => `brightness(${brightness}%) contrast(${contrast}%)`,
    [brightness, contrast],
  );

  const onCropComplete = useCallback((_area: any, areaPixels: any) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  const replacePreview = useCallback(
    (url: string) => {
      clearPreview();
      previewUrlRef.current = url;
      setPreviewUrl(url);
    },
    [clearPreview],
  );

  const resetEdits = useCallback(() => {
    setCrop({ ...DEFAULT_CROP });
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setErr(null);
    setCroppedAreaPixels(null);
    clearPreview();
  }, [clearPreview]);

  useEffect(() => {
    if (props.open) resetEdits();
  }, [props.imageSrc, props.open, resetEdits]);

  useEffect(() => {
    return () => clearPreview();
  }, [clearPreview]);

  useEffect(() => {
    if (!props.open || !croppedAreaPixels) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const blob = await cropImageToBlob(
          props.imageSrc,
          croppedAreaPixels,
          cropOptions,
        );
        if (cancelled) return;
        replacePreview(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) clearPreview();
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    clearPreview,
    cropOptions,
    croppedAreaPixels,
    props.imageSrc,
    props.open,
    replacePreview,
  ]);

  async function handleSave() {
    setErr(null);
    if (!croppedAreaPixels) {
      setErr("Please crop the signature area.");
      return;
    }
    setBusy(true);
    try {
      const blob = await cropImageToBlob(
        props.imageSrc,
        croppedAreaPixels,
        cropOptions,
      );
      await props.onCropped(blob);
      props.onOpenChange(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to crop");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-[900px]">
        <DialogHeader className="space-y-1">
          <DialogTitle>Trim your signature</DialogTitle>
          <DialogDescription>
            Crop tightly around the signature so it appears clean on approvals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative h-[260px] w-full overflow-hidden rounded-xl border bg-muted/30 sm:h-[380px]">
              <Cropper
                image={props.imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={3.5}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={(value) => setRotation(wrapRotation(value))}
                onCropComplete={onCropComplete}
                restrictPosition={false}
                showGrid={false}
                style={{ mediaStyle: { filter: imageFilter } }}
              />
            </div>

            <div className="rounded-xl border bg-background p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-medium">Preview</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetEdits}
                  disabled={busy}
                >
                  <RefreshCw className="size-4" />
                  Reset
                </Button>
              </div>
              <div className="flex aspect-[3.5/1] items-center justify-center overflow-hidden rounded-lg border bg-white p-2">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="signature preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Preview will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdjustmentControl label="Zoom" value={`${zoom.toFixed(2)}x`}>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.05}
                onValueChange={(v) => setZoom(v[0] ?? 1)}
              />
            </AdjustmentControl>

            <AdjustmentControl label="Rotation" value={`${rotation} deg`}>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Rotate left"
                  aria-label="Rotate left"
                  onClick={() => setRotation((value) => wrapRotation(value - 90))}
                  disabled={busy}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Slider
                  className="min-w-0 flex-1"
                  value={[rotation]}
                  min={-180}
                  max={180}
                  step={1}
                  onValueChange={(v) => setRotation(wrapRotation(v[0] ?? 0))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Rotate right"
                  aria-label="Rotate right"
                  onClick={() => setRotation((value) => wrapRotation(value + 90))}
                  disabled={busy}
                >
                  <RotateCw className="size-4" />
                </Button>
              </div>
            </AdjustmentControl>

            <AdjustmentControl
              label="Brightness"
              value={`${Math.round(brightness)}%`}
            >
              <Slider
                value={[brightness]}
                min={60}
                max={160}
                step={1}
                onValueChange={(v) =>
                  setBrightness(clamp(v[0] ?? 100, 60, 160))
                }
              />
            </AdjustmentControl>

            <AdjustmentControl label="Contrast" value={`${Math.round(contrast)}%`}>
              <Slider
                value={[contrast]}
                min={60}
                max={200}
                step={1}
                onValueChange={(v) => setContrast(clamp(v[0] ?? 100, 60, 200))}
              />
            </AdjustmentControl>
          </div>

          {err && <div className="text-sm text-destructive">{err}</div>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Saving..." : "Save Signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

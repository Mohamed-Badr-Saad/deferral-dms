"use client";

import { useCallback, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
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

export function SignatureCropDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imageSrc: string;
  onCropped: (blob: Blob) => Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_area: any, areaPixels: any) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const sliderValue = useMemo(() => [zoom], [zoom]);

  async function handleSave() {
    setErr(null);
    if (!croppedAreaPixels) {
      setErr("Please crop the signature area.");
      return;
    }
    setBusy(true);
    try {
      const blob = await cropImageToBlob(props.imageSrc, croppedAreaPixels);
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
      <DialogContent className="sm:max-w-[820px] rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle>Trim your signature</DialogTitle>
          <DialogDescription>
            Crop tightly around the signature so it appears clean on approvals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative h-[380px] w-full overflow-hidden rounded-xl border bg-muted/30">
            <Cropper
              image={props.imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={3.5}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition={false}
              showGrid={false}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Zoom</div>
              <div className="text-xs text-muted-foreground">
                {zoom.toFixed(2)}x
              </div>
            </div>
            <Slider
              value={sliderValue}
              min={1}
              max={3}
              step={0.05}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
            />
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

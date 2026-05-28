export async function cropImageToBlob(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  options: {
    rotation?: number;
    brightness?: number;
    contrast?: number;
  } = {},
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const rotation = options.rotation ?? 0;
  const brightness = options.brightness ?? 100;
  const contrast = options.contrast ?? 100;
  const rotationRadians = (rotation * Math.PI) / 180;
  const rotatedSize = rotatedBoundingBox(
    image.naturalWidth,
    image.naturalHeight,
    rotationRadians,
  );

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, Math.round(rotatedSize.width));
  sourceCanvas.height = Math.max(1, Math.round(rotatedSize.height));

  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) throw new Error("Failed to create canvas context");

  sourceCtx.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
  sourceCtx.rotate(rotationRadians);
  sourceCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  sourceCtx.drawImage(
    image,
    -image.naturalWidth / 2,
    -image.naturalHeight / 2,
    image.naturalWidth,
    image.naturalHeight,
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pixelCrop.width));
  canvas.height = Math.max(1, Math.round(pixelCrop.height));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas context");

  ctx.drawImage(
    sourceCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Failed to crop image"));
      resolve(blob);
    }, "image/png");
  });
}

function rotatedBoundingBox(width: number, height: number, radians: number) {
  return {
    width:
      Math.abs(Math.cos(radians) * width) +
      Math.abs(Math.sin(radians) * height),
    height:
      Math.abs(Math.sin(radians) * width) +
      Math.abs(Math.cos(radians) * height),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

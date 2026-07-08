export type PreprocessVariant = {
  name: string;
  blob: Blob;
};

const TARGET_LONG_EDGE = 2000;

async function canvasFromFile(file: File): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, TARGET_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas unavailable");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { canvas, ctx, width, height };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to encode image"));
        else resolve(blob);
      },
      "image/png",
      1,
    );
  });
}

function cloneCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(source, 0, 0);
  return { canvas, ctx };
}

function toGrayscale(data: Uint8ClampedArray, contrast = 1, brightness = 0) {
  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray = (gray - 128) * contrast + 128 + brightness;
    gray = Math.min(255, Math.max(0, gray));
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

function softThreshold(data: Uint8ClampedArray) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += data[i];
  const mean = sum / (data.length / 4);
  const threshold = Math.min(190, Math.max(120, mean * 0.95));

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const value = gray > threshold ? 255 : gray < threshold - 35 ? 0 : gray;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/**
 * 여러 전처리 변형을 만듭니다.
 * 인바디처럼 이미 선명한 이미지는 과도한 이진화가 오히려 해롭기 때문에
 * 원본/약한 보정 변형을 함께 사용합니다.
 */
export async function preprocessInbodyVariants(file: File): Promise<PreprocessVariant[]> {
  const base = await canvasFromFile(file);
  const variants: PreprocessVariant[] = [];

  // 1) scaled color original
  variants.push({ name: "original", blob: await canvasToBlob(base.canvas) });

  // 2) mild grayscale + contrast (best for clear sheets)
  {
    const { canvas, ctx } = cloneCanvas(base.canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    toGrayscale(imageData.data, 1.2, 8);
    ctx.putImageData(imageData, 0, 0);
    variants.push({ name: "gray-mild", blob: await canvasToBlob(canvas) });
  }

  // 3) stronger grayscale contrast
  {
    const { canvas, ctx } = cloneCanvas(base.canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    toGrayscale(imageData.data, 1.45, 0);
    ctx.putImageData(imageData, 0, 0);
    variants.push({ name: "gray-strong", blob: await canvasToBlob(canvas) });
  }

  // 4) soft binarize (helps some printed sheets)
  {
    const { canvas, ctx } = cloneCanvas(base.canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    toGrayscale(imageData.data, 1.25, 0);
    softThreshold(imageData.data);
    ctx.putImageData(imageData, 0, 0);
    variants.push({ name: "soft-bin", blob: await canvasToBlob(canvas) });
  }

  return variants;
}

/** backward-compatible helper */
export async function preprocessInbodyImage(file: File): Promise<Blob> {
  const variants = await preprocessInbodyVariants(file);
  return variants.find((v) => v.name === "gray-mild")?.blob ?? variants[0].blob;
}

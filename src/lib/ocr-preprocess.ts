const TARGET_WIDTH = 1600;

/**
 * 인바디 결과지 OCR용 전처리:
 * - 긴 변을 1600px 수준으로 리사이즈
 * - 그레이스케일 + 대비/밝기 보정
 * - 단순 이진화로 글자 선명도 향상
 */
export async function preprocessInbodyImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, TARGET_WIDTH / Math.max(bitmap.width, bitmap.height));
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

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += gray;
  }
  const mean = sum / (data.length / 4);
  const threshold = Math.min(200, Math.max(110, mean * 0.92));
  const contrast = 1.35;

  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray = (gray - 128) * contrast + 128;
    gray = Math.min(255, Math.max(0, gray));
    // soft binarize: keep some gray for better Tesseract digit edges
    const value = gray > threshold ? 255 : gray < threshold - 40 ? 0 : gray;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

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

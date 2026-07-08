import type { OcrFields, OcrParseResult } from "@/lib/inbody-ocr";
import { parseInbodyOcrText } from "@/lib/inbody-ocr";

export type TextParseSource = "paste" | "pdf" | "image";

export type TextParseOutcome = OcrParseResult & {
  source: TextParseSource;
  sourceLabel: string;
};

export function parseInbodyText(rawText: string, source: TextParseSource = "paste"): TextParseOutcome {
  const parsed = parseInbodyOcrText(rawText);
  const sourceLabel =
    source === "pdf" ? "PDF 텍스트" : source === "image" ? "이미지 OCR" : "붙여넣은 텍스트";

  return {
    ...parsed,
    source,
    sourceLabel,
  };
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use CDN worker compatible with the installed pdfjs major version
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    pages.push(line);
  }

  return pages.join("\n");
}

export function summarizeParseResult(
  result: TextParseOutcome,
  fieldLabels: Record<keyof OcrFields, string>,
) {
  if (result.foundFields.length === 0) {
    return `${result.sourceLabel}에서 인바디 수치를 찾지 못했습니다.`;
  }

  const found = result.foundFields.map((f) => fieldLabels[f]).join(", ");
  const confidenceText =
    result.confidence === "high"
      ? "인식 완료"
      : result.confidence === "partial"
        ? "일부 인식"
        : "인식률 낮음";

  return `${confidenceText} (${result.sourceLabel}): ${found} 항목을 자동 입력했습니다. 값을 확인·수정한 뒤 저장해주세요.`;
}

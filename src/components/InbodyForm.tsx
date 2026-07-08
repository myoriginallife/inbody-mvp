"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mergeOcrResults, parseInbodyOcrText, type OcrFields } from "@/lib/inbody-ocr";
import {
  extractTextFromPdf,
  parseInbodyText,
  summarizeParseResult,
} from "@/lib/inbody-text";
import { preprocessInbodyVariants } from "@/lib/ocr-preprocess";

type FormValues = {
  weight: string;
  skeletalMuscle: string;
  bodyFatPercent: string;
  bmi: string;
  bodyFatMass: string;
  visceralFat: string;
  basalMetabolicRate: string;
};

const emptyValues: FormValues = {
  weight: "",
  skeletalMuscle: "",
  bodyFatPercent: "",
  bmi: "",
  bodyFatMass: "",
  visceralFat: "",
  basalMetabolicRate: "",
};

const FIELD_LABELS: Record<keyof OcrFields, string> = {
  weight: "체중",
  skeletalMuscle: "골격근량",
  bodyFatPercent: "체지방률",
  bmi: "BMI",
  bodyFatMass: "체지방량",
  visceralFat: "내장지방",
  basalMetabolicRate: "기초대사량",
};

const SAMPLE_TEXT = `체중 71.2 kg
골격근량 30.8 kg
체지방률 24.1 %
BMI 24.6
체지방량 17.2 kg
내장지방 8
기초대사량 1480`;

export function InbodyForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseMessage, setParseMessage] = useState("");
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [rawText, setRawText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  function applyOcrFields(fields: OcrFields) {
    setValues((prev) => ({
      weight: fields.weight?.toString() ?? prev.weight,
      skeletalMuscle: fields.skeletalMuscle?.toString() ?? prev.skeletalMuscle,
      bodyFatPercent: fields.bodyFatPercent?.toString() ?? prev.bodyFatPercent,
      bmi: fields.bmi?.toString() ?? prev.bmi,
      bodyFatMass: fields.bodyFatMass?.toString() ?? prev.bodyFatMass,
      visceralFat: fields.visceralFat?.toString() ?? prev.visceralFat,
      basalMetabolicRate: fields.basalMetabolicRate?.toString() ?? prev.basalMetabolicRate,
    }));
  }

  function applyParsedText(text: string, source: "paste" | "pdf") {
    const parsed = parseInbodyText(text, source);
    if (parsed.foundFields.length === 0) {
      setParseMessage(summarizeParseResult(parsed, FIELD_LABELS));
      return false;
    }
    applyOcrFields(parsed);
    setParseMessage(summarizeParseResult(parsed, FIELD_LABELS));
    return true;
  }

  async function handleParsePastedText() {
    setError("");
    setParseMessage("");
    const text = rawText.trim();
    if (!text) {
      setParseMessage("인바디 결과 텍스트를 붙여넣은 뒤 분석해주세요.");
      return;
    }
    setParseLoading(true);
    try {
      applyParsedText(text, "paste");
    } finally {
      setParseLoading(false);
    }
  }

  async function runImageOcr(file: File) {
    setParseLoading(true);
    setParseProgress(0);
    setParseMessage("이미지에서 텍스트를 인식하는 중입니다... (이미지 OCR은 보조 기능)");
    setError("");

    try {
      const variants = await preprocessInbodyVariants(file);
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("kor+eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setParseProgress(Math.round(m.progress * 100));
          }
        },
      });

      const psmModes = [PSM.AUTO, PSM.SINGLE_BLOCK];
      const texts: string[] = [];
      const selectedVariants = [
        variants.find((v) => v.name === "original"),
        variants.find((v) => v.name === "gray-mild"),
      ].filter(Boolean) as typeof variants;

      let pass = 0;
      const totalPasses = selectedVariants.length * psmModes.length;

      for (const variant of selectedVariants) {
        for (const psm of psmModes) {
          pass += 1;
          setParseMessage(`이미지 OCR 중... (${pass}/${totalPasses})`);
          await worker.setParameters({
            tessedit_pageseg_mode: psm,
            preserve_interword_spaces: "1",
            user_defined_dpi: "300",
          });
          const { data } = await worker.recognize(variant.blob);
          if (data.text?.trim()) texts.push(data.text);
        }
      }

      await worker.terminate();

      const parsed = mergeOcrResults(texts.map((text) => parseInbodyOcrText(text)));
      if (parsed.foundFields.length === 0) {
        setParseMessage(
          "이미지에서 수치를 찾지 못했습니다. 위의 텍스트 붙여넣기나 PDF를 사용하면 정확도가 훨씬 높습니다.",
        );
        return;
      }

      applyOcrFields(parsed);
      setParseMessage(
        summarizeParseResult({ ...parsed, source: "image", sourceLabel: "이미지 OCR" }, FIELD_LABELS),
      );
    } catch {
      setParseMessage("이미지 OCR 처리 중 오류가 발생했습니다. 텍스트 붙여넣기를 이용해주세요.");
    } finally {
      setParseLoading(false);
      setParseProgress(0);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setParseMessage("");
    setError("");
    if (!file) return;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setImageFile(null);
      setParseLoading(true);
      setParseMessage("PDF에서 텍스트를 추출하는 중입니다...");
      try {
        const text = await extractTextFromPdf(file);
        setRawText(text);
        if (!text.trim()) {
          setParseMessage(
            "PDF에서 텍스트를 찾지 못했습니다. 스캔본(이미지 PDF)일 수 있습니다. 텍스트를 복사해 붙여넣거나 사진을 올려주세요.",
          );
          return;
        }
        applyParsedText(text, "pdf");
      } catch {
        setParseMessage("PDF 텍스트 추출에 실패했습니다. 텍스트를 복사해 붙여넣어주세요.");
      } finally {
        setParseLoading(false);
      }
      return;
    }

    if (file.type.startsWith("image/")) {
      setImageFile(file);
      await runImageOcr(file);
      return;
    }

    setParseMessage("지원 형식: 텍스트 붙여넣기, PDF, 이미지(jpg/png)");
  }

  function updateField(name: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    if (imageFile) formData.append("image", imageFile);
    Object.entries(values).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });

    try {
      const res = await fetch("/api/inbody", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다");
        return;
      }
      router.push(`/dashboard?record=${data.id}`);
      router.refresh();
    } catch {
      setError("저장 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-900">
        <p className="font-medium">정확도 높은 입력 순서</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>인바디 앱/웹/결과 PDF에서 텍스트 복사 → 아래에 붙여넣기</li>
          <li>또는 텍스트가 있는 PDF 업로드</li>
          <li>사진 OCR은 보조 수단 (인식률이 낮을 수 있음)</li>
        </ol>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">인바디 결과 텍스트 붙여넣기 (권장)</label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={7}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder={`예시)\n${SAMPLE_TEXT}`}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleParsePastedText}
            disabled={parseLoading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            텍스트 분석하기
          </button>
          <button
            type="button"
            onClick={() => {
              setRawText(SAMPLE_TEXT);
              setParseMessage("");
            }}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            예시 채우기
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">파일 업로드 (PDF 권장 / 이미지 보조)</label>
        <input
          name="file"
          type="file"
          accept="application/pdf,image/*"
          onChange={handleFileChange}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-zinc-500">
          PDF에 선택 가능한 텍스트가 있으면 거의 정확합니다. 스캔 PDF/사진은 OCR로 처리합니다.
        </p>
      </div>

      {parseLoading && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(parseProgress, 12)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-emerald-700">처리 중... {parseProgress || ""}</p>
        </div>
      )}

      {parseMessage && (
        <p
          className={`text-sm ${
            parseMessage.includes("오류") || parseMessage.includes("못했")
              ? "text-amber-700"
              : "text-emerald-700"
          }`}
        >
          {parseMessage}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">체중 (kg)</label>
          <input
            name="weight"
            type="number"
            required
            step="0.1"
            value={values.weight}
            onChange={(e) => updateField("weight", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="70.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">골격근량 (kg)</label>
          <input
            name="skeletalMuscle"
            type="number"
            required
            step="0.1"
            value={values.skeletalMuscle}
            onChange={(e) => updateField("skeletalMuscle", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="30.2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">체지방률 (%)</label>
          <input
            name="bodyFatPercent"
            type="number"
            required
            step="0.1"
            value={values.bodyFatPercent}
            onChange={(e) => updateField("bodyFatPercent", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="22.5"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">BMI</label>
          <input
            name="bmi"
            type="number"
            required
            step="0.1"
            value={values.bmi}
            onChange={(e) => updateField("bmi", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="24.3"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">체지방량 (kg, 선택)</label>
          <input
            name="bodyFatMass"
            type="number"
            step="0.1"
            value={values.bodyFatMass}
            onChange={(e) => updateField("bodyFatMass", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="15.8"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">내장지방 (레벨, 선택)</label>
          <input
            name="visceralFat"
            type="number"
            min={1}
            max={30}
            value={values.visceralFat}
            onChange={(e) => updateField("visceralFat", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="8"
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">기초대사량 (kcal, 선택)</label>
          <input
            name="basalMetabolicRate"
            type="number"
            value={values.basalMetabolicRate}
            onChange={(e) => updateField("basalMetabolicRate", e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            placeholder="1450"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || parseLoading}
        className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "분석 중..." : "맞춤 추천 받기"}
      </button>
    </form>
  );
}

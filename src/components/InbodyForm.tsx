"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseInbodyOcrText, type OcrFields } from "@/lib/inbody-ocr";
import { preprocessInbodyImage } from "@/lib/ocr-preprocess";

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

export function InbodyForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMessage, setOcrMessage] = useState("");
  const [values, setValues] = useState<FormValues>(emptyValues);
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

  async function runOcr(file: File) {
    if (!file.type.startsWith("image/")) {
      setOcrMessage("이미지 파일(jpg, png 등)만 자동 인식할 수 있습니다.");
      return;
    }

    setOcrLoading(true);
    setOcrProgress(0);
    setOcrMessage("이미지를 보정한 뒤 수치를 인식하는 중입니다...");
    setError("");

    try {
      const prepared = await preprocessInbodyImage(file);
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("kor+eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });

      const { data } = await worker.recognize(prepared);
      await worker.terminate();

      const parsed = parseInbodyOcrText(data.text);

      if (parsed.foundFields.length === 0) {
        setOcrMessage(
          "인바디 수치를 찾지 못했습니다. 결과지 전체를 밝고 정면에서 다시 촬영하거나 수동으로 입력해주세요.",
        );
        return;
      }

      applyOcrFields(parsed);

      const found = parsed.foundFields.map((f) => FIELD_LABELS[f]).join(", ");
      const confidenceText =
        parsed.confidence === "high"
          ? "인식 완료"
          : parsed.confidence === "partial"
            ? "일부 인식"
            : "인식률 낮음";

      setOcrMessage(
        `${confidenceText}: ${found} 항목을 자동 입력했습니다. 값을 확인·수정한 뒤 저장해주세요.`,
      );
    } catch {
      setOcrMessage("OCR 처리 중 오류가 발생했습니다. 수동으로 입력해주세요.");
    } finally {
      setOcrLoading(false);
      setOcrProgress(0);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setOcrMessage("");
    if (file) await runOcr(file);
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
      <div>
        <label className="mb-1 block text-sm font-medium">인바디 결과지 사진</label>
        <input
          name="image"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-900">
          <p className="font-medium">업로드 팁 (정확도↑)</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>갤러리에서 결과지 사진을 업로드하거나, 기기에서 직접 촬영할 수 있습니다</li>
            <li>결과지 전체가 보이게, 밝고 정면에서 찍은 사진이 좋습니다</li>
            <li>인식 후 숫자는 반드시 한번 확인해주세요</li>
          </ul>
        </div>
        {ocrLoading && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-emerald-700">OCR 진행 중... {ocrProgress}%</p>
          </div>
        )}
        {ocrMessage && (
          <p
            className={`mt-2 text-sm ${
              ocrMessage.includes("오류") || ocrMessage.includes("못했")
                ? "text-amber-700"
                : "text-emerald-700"
            }`}
          >
            {ocrMessage}
          </p>
        )}
        {imageFile && !ocrLoading && (
          <button
            type="button"
            onClick={() => runOcr(imageFile)}
            className="mt-2 text-sm text-emerald-700 underline hover:text-emerald-800"
          >
            OCR 다시 실행
          </button>
        )}
      </div>

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
        disabled={loading || ocrLoading}
        className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "분석 중..." : "맞춤 추천 받기"}
      </button>
    </form>
  );
}

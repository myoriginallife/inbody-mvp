"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile, saveRecord } from "@/lib/client-storage";
import {
  mergeOcrResults,
  parseInbodyOcrText,
  summarizeParseResult,
  type OcrFields,
} from "@/lib/inbody-ocr";
import { preprocessInbodyVariants } from "@/lib/ocr-preprocess";
import { generateRecommendations } from "@/lib/recommendations";
import { inbodySchema } from "@/lib/validations";

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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function InbodyForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseMessage, setParseMessage] = useState("");
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

  async function runImageOcr(file: File) {
    setParseLoading(true);
    setParseProgress(0);
    setParseMessage("이미지에서 텍스트를 인식하는 중입니다...");
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
        setParseMessage("이미지에서 수치를 찾지 못했습니다. 아래 항목을 직접 입력해주세요.");
        return;
      }

      applyOcrFields(parsed);
      setParseMessage(summarizeParseResult(parsed, FIELD_LABELS));
    } catch {
      setParseMessage("이미지 OCR 처리 중 오류가 발생했습니다. 수동으로 입력해주세요.");
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

    if (!file.type.startsWith("image/")) {
      setParseMessage("이미지 파일(jpg, png 등)만 업로드할 수 있습니다.");
      return;
    }

    setImageFile(file);
    await runImageOcr(file);
  }

  function updateField(name: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const profile = getProfile();
    if (!profile) {
      setError("기본 정보가 없습니다. 먼저 기본 정보를 입력해주세요.");
      setLoading(false);
      return;
    }

    const parsed = inbodySchema.safeParse({
      weight: values.weight,
      skeletalMuscle: values.skeletalMuscle,
      bodyFatMass: values.bodyFatMass || undefined,
      bodyFatPercent: values.bodyFatPercent,
      bmi: values.bmi,
      visceralFat: values.visceralFat || undefined,
      basalMetabolicRate: values.basalMetabolicRate || undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다");
      setLoading(false);
      return;
    }

    try {
      const recommendations = generateRecommendations(profile, parsed.data);
      const id = crypto.randomUUID();
      const imageDataUrl = imageFile ? await fileToDataUrl(imageFile) : undefined;

      saveRecord({
        id,
        createdAt: new Date().toISOString(),
        ...parsed.data,
        imageDataUrl,
        summary: recommendations.summary,
        dietPlan: recommendations.dietPlan,
        exercisePlan: recommendations.exercisePlan,
        rationales: recommendations.rationales,
      });

      router.push(`/dashboard?record=${id}`);
    } catch {
      setError("분석 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-900">
        <p className="font-medium">인바디 결과지 사진을 올리거나 촬영하세요</p>
        <p className="mt-1">OCR로 수치를 자동 인식합니다. 인식이 어려운 경우 아래 항목을 직접 수정할 수 있습니다.</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">결과지 사진 업로드 / 촬영</label>
        <input
          name="file"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-zinc-500">
          모바일에서는 카메라로 바로 촬영할 수 있습니다. 밝은 곳에서 결과지 전체가 보이게 찍어주세요.
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

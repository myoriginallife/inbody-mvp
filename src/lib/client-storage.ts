import type { DietPlan, ExercisePlan } from "@/lib/recommendations";
import type { ProfileInput } from "@/lib/validations";

const PROFILE_KEY = "inbody_profile";
const RECORDS_KEY = "inbody_records";

export type StoredRecord = {
  id: string;
  createdAt: string;
  weight: number;
  skeletalMuscle: number;
  bodyFatPercent: number;
  bmi: number;
  bodyFatMass?: number;
  visceralFat?: number;
  basalMetabolicRate?: number;
  imageDataUrl?: string;
  summary: string;
  dietPlan: DietPlan;
  exercisePlan: ExercisePlan;
  rationales: string[];
};

function canUseStorage() {
  return typeof window !== "undefined";
}

export function getProfile(): ProfileInput | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ProfileInput) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: ProfileInput) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getRecords(): StoredRecord[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? (JSON.parse(raw) as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveRecord(record: StoredRecord) {
  const records = getRecords();
  records.unshift(record);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function getRecordById(id: string): StoredRecord | null {
  return getRecords().find((r) => r.id === id) ?? null;
}

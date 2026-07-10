import { z } from "zod";

export const GOALS = [
  { value: "weight_loss", label: "체중 감량" },
  { value: "muscle_gain", label: "근육 증가" },
  { value: "body_fat_loss", label: "체지방 감소" },
  { value: "maintain", label: "현재 체형 유지" },
] as const;

export const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "거의 운동 안 함" },
  { value: "light", label: "주 1-2회 가벼운 활동" },
  { value: "moderate", label: "주 3-4회 운동" },
  { value: "active", label: "주 5회 이상 활발히 운동" },
] as const;

export const GENDERS = [
  { value: "male", label: "남성" },
  { value: "female", label: "여성" },
] as const;

export const profileSchema = z.object({
  gender: z.enum(["male", "female"]),
  age: z.coerce.number().int().min(14).max(100),
  height: z.coerce.number().min(100).max(250),
  goal: z.enum(["weight_loss", "muscle_gain", "body_fat_loss", "maintain"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active"]),
});

export const inbodySchema = z.object({
  weight: z.coerce.number().min(30).max(300),
  skeletalMuscle: z.coerce.number().min(10).max(80),
  bodyFatMass: z.coerce.number().min(1).max(150).optional(),
  bodyFatPercent: z.coerce.number().min(3).max(60),
  bmi: z.coerce.number().min(10).max(60),
  visceralFat: z.coerce.number().int().min(1).max(30).optional(),
  basalMetabolicRate: z.coerce.number().int().min(800).max(4000).optional(),
});

export type Goal = (typeof GOALS)[number]["value"];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]["value"];
export type Gender = (typeof GENDERS)[number]["value"];
export type ProfileInput = z.infer<typeof profileSchema>;
export type InbodyInput = z.infer<typeof inbodySchema>;

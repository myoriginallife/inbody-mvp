import type { ActivityLevel, Gender, Goal, InbodyInput, ProfileInput } from "./validations";

export type DietPlan = {
  title: string;
  dailyCalories: number;
  protein: string;
  carbs: string;
  fat: string;
  meals: string[];
  tips: string[];
};

export type ExercisePlan = {
  title: string;
  weeklyFrequency: string;
  sessions: { day: string; focus: string; exercises: string[]; duration: string }[];
  tips: string[];
};

export type RecommendationResult = {
  summary: string;
  statusLabel: string;
  dietPlan: DietPlan;
  exercisePlan: ExercisePlan;
  rationales: string[];
};

function getBodyFatCategory(gender: Gender, bodyFatPercent: number) {
  if (gender === "male") {
    if (bodyFatPercent < 10) return "저체지방";
    if (bodyFatPercent <= 20) return "표준";
    if (bodyFatPercent <= 25) return "과체지방";
    return "비만";
  }
  if (bodyFatPercent < 18) return "저체지방";
  if (bodyFatPercent <= 28) return "표준";
  if (bodyFatPercent <= 33) return "과체지방";
  return "비만";
}

function getMuscleCategory(gender: Gender, skeletalMuscle: number) {
  if (gender === "male") {
    if (skeletalMuscle < 28) return "부족";
    if (skeletalMuscle <= 34) return "표준";
    return "우수";
  }
  if (skeletalMuscle < 20) return "부족";
  if (skeletalMuscle <= 24) return "표준";
  return "우수";
}

function estimateTdee(profile: ProfileInput, weight: number, bmr?: number) {
  const estimatedBmr =
    bmr ??
    (profile.gender === "male"
      ? 10 * weight + 6.25 * profile.height - 5 * profile.age + 5
      : 10 * weight + 6.25 * profile.height - 5 * profile.age - 161);
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725,
  };
  return Math.round(estimatedBmr * multipliers[profile.activityLevel]);
}

function getCalorieTarget(tdee: number, goal: Goal) {
  if (goal === "weight_loss") return Math.round(tdee * 0.8);
  if (goal === "body_fat_loss") return Math.round(tdee * 0.85);
  if (goal === "muscle_gain") return Math.round(tdee * 1.1);
  return tdee;
}

function buildDietPlan(profile: ProfileInput, inbody: InbodyInput, tdee: number, bodyFatCategory: string): DietPlan {
  const calories = getCalorieTarget(tdee, profile.goal);
  const proteinGrams = Math.round(inbody.weight * (profile.goal === "muscle_gain" ? 1.8 : 1.4));
  const fatGrams = Math.round((calories * 0.25) / 9);
  const carbGrams = Math.round((calories - proteinGrams * 4 - fatGrams * 9) / 4);
  const meals =
    profile.goal === "muscle_gain"
      ? ["아침: 계란 2개 + 현미밥 1/2공기 + 채소", "점심: 닭가슴살 150g + 잡곡밥 + 샐러드", "저녁: 연어 또는 두부 + 고구마 + 나물", "간식: 그릭요거트 또는 프로틴 쉐이크"]
      : profile.goal === "weight_loss" || profile.goal === "body_fat_loss"
        ? ["아침: 계란 흰자 2개 + 통곡물 토스트 + 채소", "점심: 닭가슴살 샐러드 (드레싱 최소화)", "저녁: 생선구이 + 채소 위주 반찬", "간식: 견과류 한 줌 또는 방울토마토"]
        : ["아침: 균형 잡힌 한식 또는 샐러드", "점심: 단백질 + 탄수화물 + 채소", "저녁: 가벼운 단백질 위주 식사", "간식: 과일 또는 요거트"];
  const tips = [`하루 권장 칼로리는 약 ${calories}kcal입니다.`, `단백질 ${proteinGrams}g 이상을 목표로 하세요.`, "가공식품·당음료는 줄이고, 수분 섭취를 충분히 하세요."];
  if (bodyFatCategory === "과체지방" || bodyFatCategory === "비만") tips.push("저녁 식사는 취침 3시간 전에 마치는 것이 좋습니다.");
  return {
    title: profile.goal === "muscle_gain" ? "근육 증가 식단" : profile.goal === "maintain" ? "균형 유지 식단" : "체지방 관리 식단",
    dailyCalories: calories, protein: `${proteinGrams}g`, carbs: `${Math.max(carbGrams, 0)}g`, fat: `${fatGrams}g`, meals, tips,
  };
}

function buildExercisePlan(profile: ProfileInput, bodyFatCategory: string, muscleCategory: string): ExercisePlan {
  const isHighBodyFat = bodyFatCategory === "과체지방" || bodyFatCategory === "비만";
  const isLowMuscle = muscleCategory === "부족";
  if (profile.goal === "muscle_gain" || isLowMuscle) {
    return {
      title: "근력 중심 루틴", weeklyFrequency: "주 4회",
      sessions: [
        { day: "월", focus: "상체 근력", exercises: ["벤치프레스 또는 푸시업", "덤벨 로우", "숄더프레스", "플랭크 3세트"], duration: "50-60분" },
        { day: "수", focus: "하체 근력", exercises: ["스쿼트", "루마니안 데드리프트", "런지", "카프 레이즈"], duration: "50-60분" },
        { day: "금", focus: "전신 근력", exercises: ["풀업 또는 랫풀다운", "레그프레스", "딥스", "코어 운동"], duration: "50-60분" },
        { day: "토", focus: "가벼운 유산소", exercises: ["빠른 걷기 또는 사이클", "스트레칭"], duration: "30분" },
      ],
      tips: ["근력 운동 후 48시간 회복 시간을 확보하세요.", "중량은 올바른 자세를 유지할 수 있는 범위에서 점진적으로 늘리세요."],
    };
  }
  if (isHighBodyFat || profile.goal === "weight_loss" || profile.goal === "body_fat_loss") {
    return {
      title: "유산소 + 근력 복합 루틴", weeklyFrequency: "주 4-5회",
      sessions: [
        { day: "월", focus: "유산소", exercises: ["빠른 걷기 30분", "계단 오르기 10분", "스트레칭"], duration: "45분" },
        { day: "화", focus: "전신 근력", exercises: ["스쿼트", "푸시업", "덤벨 로우", "플랭크"], duration: "40분" },
        { day: "목", focus: "유산소", exercises: ["사이클 또는 조깅", "HIIT 15분 (선택)"], duration: "40-50분" },
        { day: "금", focus: "근력 + 코어", exercises: ["런지", "숄더프레스", "데드버그", "사이드 플랭크"], duration: "45분" },
        { day: "일", focus: "가벼운 활동", exercises: ["야외 걷기", "요가 또는 스트레칭"], duration: "30분" },
      ],
      tips: ["유산소는 중강도(말할 수 있을 정도의 호흡)로 진행하세요.", "체지방 감소는 식단과 운동을 함께 병행할 때 효과가 큽니다."],
    };
  }
  return {
    title: "균형 유지 루틴", weeklyFrequency: "주 3회",
    sessions: [
      { day: "월", focus: "전신 근력", exercises: ["스쿼트", "푸시업", "플랭크", "스트레칭"], duration: "40분" },
      { day: "수", focus: "유산소", exercises: ["빠른 걷기 또는 조깅", "코어 운동"], duration: "35분" },
      { day: "금", focus: "근력 + 유연성", exercises: ["덤벨 운동", "요가 또는 스트레칭"], duration: "40분" },
    ],
    tips: ["현재 체형을 유지하려면 꾸준한 활동량이 중요합니다."],
  };
}

export function generateRecommendations(profile: ProfileInput, inbody: InbodyInput): RecommendationResult {
  const bodyFatCategory = getBodyFatCategory(profile.gender, inbody.bodyFatPercent);
  const muscleCategory = getMuscleCategory(profile.gender, inbody.skeletalMuscle);
  const tdee = estimateTdee(profile, inbody.weight, inbody.basalMetabolicRate);
  const dietPlan = buildDietPlan(profile, inbody, tdee, bodyFatCategory);
  const exercisePlan = buildExercisePlan(profile, bodyFatCategory, muscleCategory);
  const goalLabels: Record<Goal, string> = { weight_loss: "체중 감량", muscle_gain: "근육 증가", body_fat_loss: "체지방 감소", maintain: "체형 유지" };
  const summary = `체지방률 ${inbody.bodyFatPercent}%(${bodyFatCategory}), 골격근량 ${inbody.skeletalMuscle}kg(${muscleCategory}) 상태입니다. 목표인 「${goalLabels[profile.goal]}」에 맞춘 식이·운동 플랜을 제안합니다.`;
  const rationales = [
    `체지방률 ${inbody.bodyFatPercent}%는 ${profile.gender === "male" ? "남성" : "여성"} 기준 ${bodyFatCategory} 범위입니다.`,
    `골격근량 ${inbody.skeletalMuscle}kg은 ${muscleCategory} 수준으로, ${muscleCategory === "부족" ? "근력 운동 비중을 높였습니다" : "현재 근육량을 유지·발전시키는 루틴을 제안합니다"}.`,
    `BMI ${inbody.bmi}를 반영해 ${dietPlan.dailyCalories}kcal 목표 칼로리를 산정했습니다.`,
    `활동 수준(${profile.activityLevel})을 고려해 주 ${exercisePlan.sessions.length}회 운동 루틴을 구성했습니다.`,
  ];
  if (inbody.visceralFat && inbody.visceralFat >= 10) rationales.push(`내장지방 ${inbody.visceralFat}레벨로 유산소와 식이 조절을 함께 권장합니다.`);
  return { summary, statusLabel: `${bodyFatCategory} · 근육 ${muscleCategory}`, dietPlan, exercisePlan, rationales };
}

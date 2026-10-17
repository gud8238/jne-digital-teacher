import type {
  BadgeDefinition,
  BadgeId,
  BadgeCollection,
} from "../../src/domain/badges";
export const ids: BadgeId[] = [
  "beginner",
  "edtech",
  "professional",
  "research",
  "lecturer",
  "coaching",
  "master",
];
export const defs: BadgeDefinition[] = ids.map((id, i) => ({
  id,
  stage: i === 0 ? 1 : i === 6 ? 3 : 2,
  name: [
    "AI디지털 입문자",
    "에듀테크 전문가",
    "전문과정 이수자",
    "수업연구 실천가",
    "강의 선도자",
    "현장코칭 전문가",
    "역량 마스터",
  ][i],
  description: "교원의 성장 역량",
  criteria: "연수와 실천 활동",
  preparation: "관련 활동을 확인하세요.",
  recommendationPriority: [9, 2, 1, 3, 4, 5, 9][i],
  criteriaStatus: "잠정 기준",
  displayOrder: i + 1,
}));
export function collection(
  earned: BadgeId[] = ["beginner", "edtech", "research"],
): BadgeCollection[] {
  return ids.map((badgeId) => ({
    badgeId,
    status: earned.includes(badgeId) ? "획득" : "미획득",
    earnedAt: earned.includes(badgeId) ? "2026-10-01" : null,
  }));
}
export const me = {
  teacher: { id: "test-01", name: "테스트교원01", school: "테스트학교" },
  collections: collection(),
};

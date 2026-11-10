import type { BadgeId } from "./domain/badges";
export const badgeAsset = (id: BadgeId) => `/assets/badge-${id}.png`;
export const stageNames = { 1: "입문", 2: "전문가", 3: "마스터" };
export const badgeNames: Record<BadgeId, string> = {
  beginner: "AI 교육 입문자",
  edtech: "AI 교육 활용 전문가",
  professional: "AI 교육 수업 전문가",
  research: "AI 교육 연구 실천가",
  lecturer: "AI 교육 강의 전문가",
  coaching: "AI 교육 코칭 전문가",
  master: "AI 교육 역량 마스터",
};

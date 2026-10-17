import type { BadgeId } from "./domain/badges";
export const badgeAsset = (id: BadgeId) => `/assets/badge-${id}.png`;
export const stageNames = { 1: "입문", 2: "전문가", 3: "마스터" };
export const badgeNames: Record<BadgeId, string> = {
  beginner: "AI디지털 입문자",
  edtech: "에듀테크 전문가",
  professional: "전문과정 이수자",
  research: "수업연구 실천가",
  lecturer: "강의 선도자",
  coaching: "현장코칭 전문가",
  master: "역량 마스터",
};

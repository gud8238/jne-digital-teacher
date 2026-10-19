export const badgeIds = [
  "beginner",
  "edtech",
  "professional",
  "research",
  "lecturer",
  "coaching",
  "master",
] as const;
export type BadgeId = (typeof badgeIds)[number];
export type BadgeDefinition = {
  id: BadgeId;
  stage: 1 | 2 | 3;
  name: string;
  description: string;
  criteria: string;
  preparation: string;
  recommendationPriority: number;
  criteriaStatus: string;
  displayOrder: number;
};
export type BadgeCollection = {
  badgeId: BadgeId;
  status: "획득" | "미획득";
  earnedAt: string | null;
};
export type Teacher = { id: string; name: string; school: string | null };
export type Me = {
  teacher: Teacher;
  collections: BadgeCollection[];
  sessionExpiresAt: number;
};
export type PageData = { definitions: BadgeDefinition[]; me: Me | null };
export function validatePageData(value: unknown): PageData {
  const page = record(value);
  return {
    definitions: validateBadges(page.definitions),
    me: page.me === null ? null : validateMe(page.me),
  };
}
export type Progress = {
  earnedCount: number;
  expertCount: number;
  overallPercent: number;
  expertPercent: number;
  remainingExperts: number;
  masterState: "in-progress" | "eligible" | "awarded";
};
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

const fail = (): never => {
  throw new Error("배지 데이터가 올바르지 않습니다. 관리자에게 확인해 주세요.");
};
const record = (v: unknown): Record<string, any> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : fail();
const text = (v: unknown): string =>
  typeof v === "string" && v.trim() ? v : fail();
const id = (v: unknown): BadgeId =>
  badgeIds.includes(v as BadgeId) ? (v as BadgeId) : fail();
function complete(ids: string[]) {
  if (ids.length !== 7 || new Set(ids).size !== 7) fail();
}
export function validateBadges(value: unknown): BadgeDefinition[] {
  if (!Array.isArray(value)) return fail();
  const result = value.map((v) => {
    const b = record(v);
    const badgeId = id(b.id);
    const expectedStage =
      badgeId === "beginner" ? 1 : badgeId === "master" ? 3 : 2;
    if (
      b.stage !== expectedStage ||
      !Number.isFinite(b.recommendationPriority) ||
      !Number.isFinite(b.displayOrder)
    )
      fail();
    return {
      id: badgeId,
      stage: expectedStage,
      name: text(b.name),
      description: text(b.description),
      criteria: text(b.criteria),
      preparation: text(b.preparation),
      recommendationPriority: b.recommendationPriority,
      criteriaStatus: text(b.criteriaStatus),
      displayOrder: b.displayOrder,
    } as BadgeDefinition;
  });
  complete(result.map((b) => b.id));
  return result.sort((a, b) => a.displayOrder - b.displayOrder);
}
export function validateCollections(value: unknown): BadgeCollection[] {
  if (!Array.isArray(value)) return fail();
  const rows = value.map((v) => {
    const row = record(v);
    const badgeId = id(row.badgeId);
    if (row.status !== "획득" && row.status !== "미획득") fail();
    const date = row.earnedAt;
    if (
      date !== null &&
      (typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      fail();
    if (row.status === "미획득" && date !== null) fail();
    return { badgeId, status: row.status, earnedAt: date } as BadgeCollection;
  });
  complete(rows.map((row) => row.badgeId));
  return rows;
}
export function validateMe(value: unknown): Me {
  const m = record(value),
    t = record(m.teacher);
  if (t.school !== null && typeof t.school !== "string") fail();
  if (!Number.isSafeInteger(m.sessionExpiresAt) || m.sessionExpiresAt <= 0)
    fail();
  return {
    teacher: {
      id: text(t.id),
      name: text(t.name),
      school: t.school?.trim() || null,
    },
    collections: validateCollections(m.collections),
    sessionExpiresAt: m.sessionExpiresAt,
  };
}
export function calculateProgress(
  definitions: BadgeDefinition[],
  collections: BadgeCollection[],
): Progress {
  const defs = validateBadges(definitions),
    rows = validateCollections(collections);
  const earned = new Set(
    rows.filter((r) => r.status === "획득").map((r) => r.badgeId),
  );
  const expertCount = defs.filter(
    (b) => b.stage === 2 && earned.has(b.id),
  ).length;
  return {
    earnedCount: earned.size,
    expertCount,
    overallPercent: Math.round((earned.size / 7) * 100),
    expertPercent: Math.round((expertCount / 5) * 100),
    remainingExperts: Math.max(0, 3 - expertCount),
    masterState: earned.has("master")
      ? "awarded"
      : expertCount >= 3
        ? "eligible"
        : "in-progress",
  };
}
export function recommendBadges(
  definitions: BadgeDefinition[],
  collections: BadgeCollection[],
): BadgeDefinition[] {
  const earned = new Set(
    validateCollections(collections)
      .filter((r) => r.status === "획득")
      .map((r) => r.badgeId),
  );
  return validateBadges(definitions)
    .filter((b) => b.stage === 2 && !earned.has(b.id))
    .sort(
      (a, b) =>
        a.recommendationPriority - b.recommendationPriority ||
        a.displayOrder - b.displayOrder,
    );
}

// Sheet column order is intentionally different from the API's badge order.
export const collectionColumns = [
  ["beginner", "AI디지털 입문자"],
  ["edtech", "에듀테크 전문가"],
  ["research", "수업연구 실천가"],
  ["professional", "전문과정 이수자"],
  ["lecturer", "강의 선도자"],
  ["coaching", "현장코칭 전문가"],
  ["master", "역량 마스터"],
];
export const collectionHeaders = [
  "teacher_id",
  ...collectionColumns.map((c) => c[1]),
  ...collectionColumns.map((c) => c[1] + " 취득일"),
];
export function pivotCollections(legacyRows) {
  const teachers = new Map();
  if (!Array.isArray(legacyRows) || !legacyRows.length)
    throw new Error("변환할 수집현황이 없습니다.");
  for (const row of legacyRows) {
    if (
      !Array.isArray(row) ||
      row.length !== 4 ||
      row.some((v) => typeof v !== "string")
    )
      throw new Error("기존 수집현황의 열을 확인해 주세요.");
    const [teacherId, badgeId, status, date] = row;
    if (
      !teacherId.trim() ||
      teacherId.startsWith("=") ||
      !collectionColumns.some((c) => c[0] === badgeId) ||
      !["획득", "미획득"].includes(status)
    )
      throw new Error("교원·배지 ID 또는 수집현황이 올바르지 않습니다.");
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw new Error("취득일이 올바르지 않습니다.");
    if (!teachers.has(teacherId)) teachers.set(teacherId, new Map());
    const badges = teachers.get(teacherId);
    if (badges.has(badgeId)) throw new Error("중복된 수집현황입니다.");
    badges.set(badgeId, { status, date });
  }
  return [...teachers].map(([teacherId, badges]) => {
    if (badges.size !== 7)
      throw new Error("교원별 7개 배지가 모두 필요합니다.");
    return [
      teacherId,
      ...collectionColumns.map((c) => badges.get(c[0]).status),
      ...collectionColumns.map((c) => badges.get(c[0]).date),
    ];
  });
}

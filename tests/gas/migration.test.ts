import { it, expect } from "vitest";
import {
  pivotCollections,
  collectionHeaders,
} from "../../scripts/collection-migration.mjs";
import { ids } from "../fixtures/badges";
const legacy = ids.map((id) => [
  "teacher-x",
  id,
  id === "research" ? "획득" : "미획득",
  id === "research" ? "2026-10-12" : "",
]);
it("연구·전문 순서를 맞추고 교원별 상태와 원래 취득일을 한 행에 보존한다", () => {
  expect(collectionHeaders.slice(0, 8)).toEqual([
    "teacher_id",
    "AI디지털 입문자",
    "에듀테크 전문가",
    "수업연구 실천가",
    "전문과정 이수자",
    "강의 선도자",
    "현장코칭 전문가",
    "역량 마스터",
  ]);
  const rows = pivotCollections([
    ...legacy,
    ...legacy.map((row) => ["teacher-y", ...row.slice(1)]),
  ]);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveLength(15);
  expect(rows[0][3]).toBe("획득");
  expect(rows[0][4]).toBe("미획득");
  expect(rows[0][10]).toBe("2026-10-12");
  expect(rows[1][0]).toBe("teacher-y");
});
it("누락·중복·알 수 없는 ID·수식·잘못된 상태는 덮어쓰기 전에 거절한다", () => {
  for (const rows of [
    legacy.slice(1),
    [...legacy, legacy[0]],
    [...legacy.slice(1), ["teacher-x", "other", "미획득", ""]],
    [...legacy.slice(1), ["=formula", "beginner", "미획득", ""]],
    [...legacy.slice(1), ["teacher-x", "beginner", "완료", ""]],
  ]) {
    expect(() => pivotCollections(rows)).toThrow();
  }
});

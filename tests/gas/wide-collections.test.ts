import { it, expect } from "vitest";
import { runtime } from "./runtime";
import { collection } from "../fixtures/badges";

function setup() {
  const r = runtime();
  r.tables["배지별 수집현황"] = [
    {
      teacher_id: "test-01",
      "AI디지털 입문자": "획득",
      "에듀테크 전문가": "획득",
      "수업연구 실천가": "획득",
      "전문과정 이수자": "미획득",
      "강의 선도자": "미획득",
      "현장코칭 전문가": "미획득",
      "역량 마스터": "미획득",
      "AI디지털 입문자 취득일": "2026-10-01",
      "에듀테크 전문가 취득일": "2026-10-01",
      "수업연구 실천가 취득일": "2026-10-01",
    },
  ];
  const token = r.call({
    action: "login",
    neisNumber: "0000000001",
    name: "테스트교원01",
  }).data.token;
  return { ...r, me: () => r.call({ action: "me", token }) };
}
it("교원 한 행의 7개 상태를 기존 웹앱 계약으로 변환하고 연구·전문 배지를 구분한다", () => {
  const r = setup();
  expect(r.me().data?.collections).toEqual(collection());
});
it("드롭다운만 미획득으로 바꾸어도 예전 날짜를 숨기고 다시 획득하면 보존한 날짜를 읽는다", () => {
  const r = setup(),
    row = r.tables["배지별 수집현황"][0];
  row["AI디지털 입문자"] = "미획득";
  expect(r.me().data?.collections[0]).toEqual({
    badgeId: "beginner",
    status: "미획득",
    earnedAt: null,
  });
  row["AI디지털 입문자"] = "획득";
  expect(r.me().data?.collections[0].earnedAt).toBe("2026-10-01");
});
it("새로 획득하고 취득일이 비어 있으면 임의의 날짜를 만들지 않는다", () => {
  const r = setup();
  r.tables["배지별 수집현황"][0]["역량 마스터"] = "획득";
  expect(
    r.me().data?.collections.find((b: any) => b.badgeId === "master").earnedAt,
  ).toBeNull();
});
it.each([
  "missingRow",
  "duplicateTeacher",
  "missingColumn",
  "invalidStatus",
  "invalidDate",
])("가로형 데이터의 %s 오류를 거절한다", (mode) => {
  const r = setup(),
    rows = r.tables["배지별 수집현황"];
  if (mode === "missingRow") rows.pop();
  if (mode === "duplicateTeacher") rows.push({ ...rows[0] });
  if (mode === "missingColumn") delete rows[0]["수업연구 실천가"];
  if (mode === "invalidStatus") rows[0]["역량 마스터"] = "완료";
  if (mode === "invalidDate") rows[0]["AI디지털 입문자 취득일"] = "2026-02-31";
  expect(r.me().error?.code).toBe("DATA_ERROR");
});

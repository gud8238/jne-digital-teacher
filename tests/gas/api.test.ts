import { describe, it, expect } from "vitest";
import { runtime } from "./runtime";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { seed, headers } from "../../scripts/seed-data.mjs";
const login = {
  action: "login",
  neisNumber: "0000000001",
  name: "테스트교원01",
};
describe("GAS 인증과 데이터 경계", () => {
  it("페이지 요청 하나가 최신 배지 정의와 개인 현황을 함께 반환한다", () => {
    const r = runtime();
    const token = r.call(login).data.token;
    r.tables["배지소개"][0]["취득기준"] = "변경된 기준\n두 번째 줄";
    const result = r.call({ action: "page", token });
    expect(result.ok).toBe(true);
    expect(result.data.definitions[0].criteria).toBe("변경된 기준\n두 번째 줄");
    expect(result.data.me.collections).toHaveLength(7);
    expect(r.call({ action: "page" }).data.me).toBeNull();
    r.advance(14400000);
    expect(r.call({ action: "page", token }).data.me).toBeNull();
  });
  it("로그인 응답에 배지 정의와 수집현황을 포함해 후속 조회를 생략한다", () => {
    const result = runtime().call(login);
    expect(result.data.definitions).toHaveLength(7);
    expect(result.data.collections).toHaveLength(7);
    expect(result.data.sessionExpiresAt).toBeGreaterThan(0);
  });
  it("앞자리 0과 공백을 보존해 본인만 로그인한다", () => {
    const r = runtime();
    const result = r.call({
      ...login,
      neisNumber: " 0000000001 ",
      name: " 테스트교원01 ",
    });
    expect(result.ok).toBe(true);
    expect(result.data.teacher).toEqual({
      id: "test-01",
      name: "테스트교원01",
      school: "테스트학교",
    });
    expect(r.call({ ...login, neisNumber: "1" }).error.code).toBe(
      "UNAUTHORIZED",
    );
    expect(r.call({ ...login, name: "다른이름" }).ok).toBe(false);
    expect(
      r.call({ ...login, neisNumber: "0000000002", name: "테스트교원02" }).ok,
    ).toBe(false);
  });
  it("세션이 없거나 만료·로그아웃하면 개인조회할 수 없다", () => {
    const r = runtime();
    expect(r.call({ action: "me" }).error.code).toBe("UNAUTHORIZED");
    const token = r.call(login).data.token;
    expect(r.call({ action: "me", token }).data.collections).toHaveLength(7);
    expect(r.call({ action: "me", token, teacher_id: "test-02" }).ok).toBe(
      false,
    );
    r.advance(4 * 60 * 60 * 1000);
    expect(r.call({ action: "me", token }).error.code).toBe("UNAUTHORIZED");
    const token2 = r.call(login).data.token;
    r.call({ action: "logout", token: token2 });
    expect(r.call({ action: "me", token: token2 }).ok).toBe(false);
  });
  it("공유 비밀값을 검사하고 공개 배지 7종만 제공한다", () => {
    const r = runtime();
    expect(r.call({ action: "badges", key: "wrong" }).ok).toBe(false);
    expect(r.call({ action: "badges" }).data).toHaveLength(7);
    expect(r.call({ action: "unknown" }).ok).toBe(false);
  });
  it.each(["missing", "duplicate", "status", "date"])(
    "잘못된 개인 수집행 %s를 오류로 처리한다",
    (mode) => {
      const r = runtime(),
        token = r.call(login).data.token,
        rows = r.tables["배지별 수집현황"];
      if (mode === "missing") rows.pop();
      if (mode === "duplicate") rows[6] = rows[0];
      if (mode === "status") rows[0]["수집현황"] = "완료";
      if (mode === "date") rows[0]["취득일"] = "2026-02-31";
      expect(r.call({ action: "me", token }).error.code).toBe("DATA_ERROR");
    },
  );
  it("중복 나이스번호가 있으면 임의 교원을 선택하지 않는다", () => {
    const r = runtime();
    r.tables["교원"].push({ ...r.tables["교원"][0], teacher_id: "duplicate" });
    expect(r.call(login).error.code).toBe("DATA_ERROR");
  });
});
it.each([
  ["doGet", "badges"],
  ["doGet", "me"],
  ["doPost", "page"],
  ["doPost", "me"],
])(
  "실제 %s 어댑터가 읽기 전용 Sheets API로 %s JSON을 반환한다",
  (method, action) => {
    const fixture = runtime();
    fixture.tables["배지별 수집현황"] = seed.collections.map((row) =>
      Object.fromEntries(headers.collections.map((h, i) => [h, row[i]])),
    );
    let outbound = "";
    const context = vm.createContext({
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (key: string) =>
            key === "SPREADSHEET_ID" ? "sheet-id" : "test-secret",
        }),
      },
      CacheService: {
        getScriptCache: () => ({
          get: () =>
            JSON.stringify({
              teacherId: "test-01",
              expiresAt: Date.now() + 14400000,
            }),
        }),
      },
      ScriptApp: { getOAuthToken: () => "oauth-token" },
      UrlFetchApp: {
        fetch: (url: string, options: any) => {
          outbound = url;
          expect(options.headers.Authorization).toBe("Bearer oauth-token");
          const name = decodeURIComponent(
            new URL(url).pathname.split("/values/")[1],
          ).replace(/^'|'$/g, "");
          const rows = fixture.tables[name];
          return {
            getResponseCode: () => 200,
            getContentText: () =>
              JSON.stringify({
                values: [
                  Object.keys(rows[0]),
                  ...rows.map((r) => Object.values(r)),
                ],
              }),
          };
        },
      },
      ContentService: {
        MimeType: { JSON: "application/json" },
        createTextOutput: (value: string) => ({
          setMimeType: (mime: string) => ({ value, mime }),
        }),
      },
    });
    vm.runInContext(readFileSync("gas/Code.js", "utf8"), context);
    const params = { key: "test-secret", action, token: "a".repeat(64) };
    const result =
      method === "doGet"
        ? context.doGet({ parameter: params })
        : context.doPost({ postData: { contents: JSON.stringify(params) } });
    expect(JSON.parse(result.value).ok).toBe(true);
    if (action === "me") {
      const me = JSON.parse(result.value).data;
      expect(
        me.collections.filter((b: any) => b.status === "획득"),
      ).toHaveLength(3);
      expect(
        me.collections.find((b: any) => b.badgeId === "research").earnedAt,
      ).toBe("2026-10-01");
    }
    expect(result.mime).toBe("application/json");
    expect(outbound).toContain(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet-id/values/",
    );
    expect(outbound).not.toContain("test-secret");
  },
);

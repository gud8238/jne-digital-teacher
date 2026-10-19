import { describe, it, expect } from "vitest";
import { handleApi } from "../../server/handler";
import { runtime } from "../gas/runtime";
const base = "https://badge.example";
const req = (
  path: string,
  method = "GET",
  body?: string,
  cookie?: string,
  origin = base,
) =>
  new Request(base + "/api/" + path, {
    method,
    headers: {
      "content-type": "application/json",
      origin,
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body } : {}),
  });
function setup() {
  const gas = runtime();
  return {
    gas,
    deps: {
      gasUrl: "https://script.google.com/macros/s/test/exec",
      gasSecret: "test-secret",
      fetcher: async (_url: any, init?: RequestInit) =>
        Response.json(gas.call(JSON.parse(String(init?.body)))),
    },
  };
}
const login = JSON.stringify({
  neisNumber: "0000000001",
  name: "테스트교원01",
});
describe("브라우저 API 경계", () => {
  it("만료 쿠키가 있어도 POST 한 번으로 공개 화면을 복원하며 새 쿠키를 지우지 않는다", async () => {
    const { deps } = setup();
    const original = deps.fetcher;
    let calls = 0;
    deps.fetcher = async (url, init) => {
      calls++;
      expect(init?.method).toBe("POST");
      expect(String(url)).not.toContain("test-secret");
      expect(JSON.parse(String(init?.body)).key).toBe("test-secret");
      return original(url, init);
    };
    const response = await handleApi(
      req("page", "POST", "{}", "jne_badge_session=" + "b".repeat(64)),
      deps,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.me).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(calls).toBe(1);
  });
  it("페이지 POST 하나로 공개 배지와 선택적 개인 현황을 반환한다", async () => {
    const { deps } = setup();
    const response = await handleApi(
      req("page", "POST", JSON.stringify({ path: "/badges" })),
      deps,
    );
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.definitions).toHaveLength(7);
    expect(data.me).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it.each([undefined, "jne_badge_session=" + "b".repeat(64)])(
    "실패한 이전 세션 조회가 새 로그인 쿠키를 지우지 않는다: %s",
    async (cookie) => {
      const { deps } = setup();
      const response = await handleApi(
        req("me", "GET", undefined, cookie),
        deps,
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );
  it("쿠키가 이미 없어도 로그아웃을 성공시키고 쿠키를 삭제한다", async () => {
    const { deps } = setup();
    const response = await handleApi(req("logout", "POST"), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await response.json()).data.loggedOut).toBe(true);
  });
  it("로그인 토큰을 쿠키로만 제공하고 개인 현황을 반환한다", async () => {
    const { deps } = setup();
    const response = await handleApi(req("login", "POST", login), deps);
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=14400");
    expect(JSON.stringify(await response.json())).not.toContain("token");
    const me = await handleApi(req("me", "GET", undefined, cookie), deps);
    const profile = (await me.json()).data;
    expect(profile.collections).toHaveLength(7);
    expect(profile.sessionExpiresAt).toBe(Date.parse("2026-10-17T04:00:00Z"));
    expect(me.headers.get("cache-control")).toBe("no-store");
    const out = await handleApi(req("logout", "POST", undefined, cookie), deps);
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      (await handleApi(req("me", "GET", undefined, cookie), deps)).status,
    ).toBe(401);
  });
  it("로그인 입력·메서드·출처·세션을 검사한다", async () => {
    const { deps } = setup();
    expect((await handleApi(req("login", "POST", "{"), deps)).status).toBe(400);
    expect((await handleApi(req("login", "POST", "{}"), deps)).status).toBe(
      400,
    );
    expect((await handleApi(req("login"), deps)).status).toBe(405);
    expect((await handleApi(req("me"), deps)).status).toBe(401);
    expect(
      (
        await handleApi(
          req("login", "POST", login, undefined, "https://other.example"),
          deps,
        )
      ).status,
    ).toBe(403);
  });
  it("공개 배지는 완전한 7종이어야 한다", async () => {
    const { gas, deps } = setup();
    expect(
      (await (await handleApi(req("badges"), deps)).json()).data,
    ).toHaveLength(7);
    gas.tables["배지소개"].pop();
    expect((await handleApi(req("badges"), deps)).status).toBe(502);
  });
  it.each(["html", "invalid", "timeout"])(
    "GAS %s 응답을 비밀값 없는 API 오류로 바꾼다",
    async (mode) => {
      const { deps } = setup();
      deps.fetcher = async () => {
        if (mode === "timeout")
          throw new DOMException("timed out", "TimeoutError");
        return new Response(mode === "html" ? "<html>Sign in</html>" : "{");
      };
      const response = await handleApi(req("badges"), deps);
      expect(response.status).toBe(mode === "timeout" ? 503 : 502);
      expect(await response.text()).not.toContain("test-secret");
    },
  );
});

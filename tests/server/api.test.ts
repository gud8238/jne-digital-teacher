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
      fetcher: async (url: any) =>
        Response.json(
          gas.call(Object.fromEntries(new URL(String(url)).searchParams)),
        ),
    },
  };
}
const login = JSON.stringify({
  neisNumber: "0000000001",
  name: "테스트교원01",
});
describe("브라우저 API 경계", () => {
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
    expect((await me.json()).data.collections).toHaveLength(7);
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

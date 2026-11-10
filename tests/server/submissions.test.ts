import { it, expect } from "vitest";
import { handleApi } from "../../server/handler";
import { defs, me } from "../fixtures/badges";
const base = "https://badge.example";
function request(action: string, body: unknown, cookie = true) {
  return new Request(`${base}/api/${action}`, {
    method: "POST",
    headers: {
      origin: base,
      "content-type": "application/json",
      ...(cookie ? { cookie: "jne_badge_session=" + "a".repeat(64) } : {}),
    },
    body: JSON.stringify(body),
  });
}
function setup(data: unknown) {
  const calls: any[] = [];
  return {
    calls,
    deps: {
      gasUrl: "https://script.google.com/macros/s/test/exec",
      gasSecret: "secret",
      fetcher: async (_url: any, init?: RequestInit) => {
        calls.push(JSON.parse(String(init?.body)));
        return Response.json({ ok: true, data });
      },
    },
  };
}
it("이름과 연수원 아이디로 로그인하며 이전 나이스 입력은 거절한다", async () => {
  const { calls, deps } = setup({
    ...me,
    definitions: defs,
    token: "a".repeat(64),
  });
  const good = await handleApi(
    request("login", { name: "테스트교원01", trainingId: "jne-test01" }, false),
    deps,
  );
  expect(good.status).toBe(200);
  expect(calls[0]).toMatchObject({
    name: "테스트교원01",
    trainingId: "jne-test01",
  });
  expect(calls[0]).not.toHaveProperty("neisNumber");
  expect(
    (
      await handleApi(
        request(
          "login",
          { name: "테스트교원01", neisNumber: "0000000001" },
          false,
        ),
        deps,
      )
    ).status,
  ).toBe(400);
});
it("세션 없이 제출하거나 마스터·과대 파일을 제출하려 하면 GAS를 호출하지 않는다", async () => {
  const { calls, deps } = setup({});
  const valid = {
    badgeId: "professional",
    fileName: "증빙.hwpx",
    mimeType: "",
    size: 100,
  };
  expect(
    (await handleApi(request("submission-start", valid, false), deps)).status,
  ).toBe(401);
  expect(
    (
      await handleApi(
        request("submission-start", { ...valid, badgeId: "master" }),
        deps,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handleApi(
        request("submission-start", { ...valid, size: 21 * 1024 * 1024 }),
        deps,
      )
    ).status,
  ).toBe(413);
  expect(calls).toHaveLength(0);
});
it("업로드 세션만 반환하고 인증·파일 형식을 서버가 결정한다", async () => {
  const { calls, deps } = setup({
    uploadId: "upload001",
    chunkSize: 1048576,
    received: 0,
  });
  const response = await handleApi(
    request("submission-start", {
      badgeId: "professional",
      fileName: "증빙.hwpx",
      mimeType: "",
      size: 1024,
      teacherId: "other",
      folderId: "arbitrary",
    }),
    deps,
  );
  expect(response.status).toBe(200);
  expect(calls[0]).toMatchObject({
    badgeId: "professional",
    fileName: "증빙.hwpx",
    mimeType: "application/hwp+zip",
    size: 1024,
    token: "a".repeat(64),
  });
  expect(calls[0]).not.toHaveProperty("folderId");
  expect(calls[0]).not.toHaveProperty("teacherId");
});
it("잘못된 청크·offset은 Drive 요청 전에 거절한다", async () => {
  const { calls, deps } = setup({});
  for (const fields of [
    { offset: -1, data: "UEsDBA==" },
    { offset: 0, data: "not-base64!" },
    { offset: 0, data: Buffer.alloc(1048577).toString("base64") },
  ]) {
    expect(
      (
        await handleApi(
          request("submission-chunk", { uploadId: "upload001", ...fields }),
          deps,
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
  }
  expect(calls).toHaveLength(0);
});
it("완료 응답은 개인 현황과 제출 상태만 반환하고 세션/Drive 업로드 URI는 노출하지 않는다", async () => {
  const collections = me.collections.map((b) =>
    b.badgeId === "professional"
      ? { ...b, status: "서류제출", earnedAt: null }
      : b,
  );
  const { deps } = setup({
    me: { ...me, collections },
    submission: {
      badgeId: "professional",
      status: "서류제출",
      fileName: "증빙.hwpx",
      submittedAt: "2026-11-10T08:00:00Z",
    },
    token: "private",
    uploadUri: "private-url",
  });
  const response = await handleApi(
    request("submission-complete", { uploadId: "upload001" }),
    deps,
  );
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).toContain("서류제출");
  expect(text).not.toContain("private");
});
it("양식 다운로드는 지정 배지만 조회하여 첨부 파일로 제공한다", async () => {
  const { deps, calls } = setup({
    fileName: "professional_양식.hwpx",
    mimeType: "application/hwp+zip",
    data: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]).toString("base64"),
  });
  const response = await handleApi(
    new Request(base + "/api/template?badgeId=professional"),
    deps,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(calls[0]).toMatchObject({
    action: "template",
    badgeId: "professional",
  });
  expect((await response.arrayBuffer()).byteLength).toBe(5);
});

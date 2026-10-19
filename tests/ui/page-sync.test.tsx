// @vitest-environment jsdom
import { StrictMode } from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App";
import { defs, me } from "../fixtures/badges";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("초기 조회 중 다른 탭에서 로그아웃하면 공개 배지만 표시하고 개인정보는 복원하지 않는다", async () => {
  let release: (response: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  render(
    <MemoryRouter initialEntries={["/badges"]}>
      <App />
    </MemoryRouter>,
  );
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: "jne-badge-logout" }),
    );
  });
  await act(async () => {
    release(
      Response.json({
        ok: true,
        data: {
          definitions: defs,
          me: { ...me, sessionExpiresAt: Date.now() + 14400000 },
        },
      }),
    );
  });
  expect(screen.queryByText(`${me.teacher.name} 선생님`)).toBeNull();
  expect(screen.getAllByRole("button", { name: /상세 보기$/ })).toHaveLength(7);
});
it("다른 탭에서 로그인한 뒤 배지함으로 이동하면 한 번 조회를 마친 후 인증 여부를 판단한다", async () => {
  let signedIn = false;
  const paths: string[] = [];
  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    paths.push(JSON.parse(String(init?.body)).path);
    return Response.json({
      ok: true,
      data: {
        definitions: defs,
        me: signedIn
          ? { ...me, sessionExpiresAt: Date.now() + 14400000 }
          : null,
      },
    });
  });
  render(
    <MemoryRouter initialEntries={["/badges"]}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByRole("region", { name: "AI디지털 입문자 상세 설명" });
  signedIn = true;
  await userEvent.click(
    screen.getAllByRole("link", { name: "나의 배지함" })[0],
  );
  await screen.findByLabelText("전체 획득 배지");
  expect(paths).toEqual(["/badges", "/my-badges"]);
});
it("로그아웃 전에 시작한 페이지 응답이 늦게 와도 개인 정보를 복원하지 않는다", async () => {
  let signedIn = true,
    pages = 0;
  let release: (response: Response) => void = () => {};
  vi.stubGlobal("fetch", async (url: string) => {
    if (url === "/api/logout") {
      signedIn = false;
      return Response.json({ ok: true, data: { loggedOut: true } });
    }
    pages++;
    if (pages === 2)
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    return Response.json({
      ok: true,
      data: {
        definitions: defs,
        me: signedIn
          ? { ...me, sessionExpiresAt: Date.now() + 14400000 }
          : null,
      },
    });
  });
  render(
    <MemoryRouter initialEntries={["/badges"]}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByText(`${me.teacher.name} 선생님`);
  await userEvent.click(screen.getAllByRole("link", { name: "인증 안내" })[0]);
  await waitFor(() => expect(pages).toBe(2));
  await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));
  await screen.findByRole("link", { name: "로그인" });
  await act(async () =>
    release(
      Response.json({
        ok: true,
        data: {
          definitions: defs,
          me: { ...me, sessionExpiresAt: Date.now() + 14400000 },
        },
      }),
    ),
  );
  expect(screen.queryByText(`${me.teacher.name} 선생님`)).toBeNull();
});
it("페이지마다 POST 한 번으로 최신 텍스트·추천 순서를 반영하고 화면 내 선택은 조회하지 않는다", async () => {
  let version = 0;
  const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
    Response.json({
      ok: true,
      data: {
        definitions: defs.map((b) => ({
          ...b,
          description: `최신 설명 ${version}`,
          criteria: `최신 기준 ${version}\n두 번째 기준`,
          preparation: `최신 준비 ${version}`,
          recommendationPriority:
            b.id === "coaching" ? -1 : b.recommendationPriority,
        })),
        me: { ...me, sessionExpiresAt: Date.now() + 14400000 },
      },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <StrictMode>
      <MemoryRouter initialEntries={["/badges"]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
  await screen.findByText("최신 기준 0 두 번째 기준");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe("/api/page");
  expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
  await userEvent.click(screen.getByRole("button", { name: "전문가" }));
  await userEvent.click(
    screen.getByRole("button", {
      name: "현장코칭 전문가 상세 보기",
    }),
  );
  window.dispatchEvent(new Event("focus"));
  expect(fetcher).toHaveBeenCalledTimes(1);
  version = 1;
  await userEvent.click(screen.getAllByRole("link", { name: "인증 안내" })[0]);
  await screen.findAllByText("최신 준비 1");
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(
    screen.getByRole("button", { name: "현장코칭 전문가 도전 준비하기" }),
  ).toBeVisible();
  version = 2;
  await userEvent.click(screen.getAllByRole("link", { name: "배지 소개" })[0]);
  await screen.findByText("최신 기준 2 두 번째 기준");
  expect(fetcher).toHaveBeenCalledTimes(3);
});

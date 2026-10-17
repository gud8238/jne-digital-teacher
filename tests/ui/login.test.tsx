// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../../src/auth/AuthProvider";
import HomePage from "../../src/pages/HomePage";
import { me } from "../fixtures/badges";
let signedIn = false;
let sent: any;
beforeEach(() => {
  signedIn = false;
  sent = null;
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url === "/api/login") {
      sent = JSON.parse(String(init?.body));
      signedIn =
        sent.neisNumber === "0000000001" && sent.name === "테스트교원01";
      return Response.json(
        signedIn
          ? { ok: true, data: { teacher: me.teacher } }
          : {
              ok: false,
              error: {
                code: "UNAUTHORIZED",
                message: "나이스번호와 이름을 확인해 주세요.",
              },
            },
        { status: signedIn ? 200 : 401 },
      );
    }
    if (url === "/api/logout") {
      signedIn = false;
      return Response.json({ ok: true, data: { loggedOut: true } });
    }
    return Response.json(
      signedIn
        ? { ok: true, data: me }
        : {
            ok: false,
            error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
          },
      { status: signedIn ? 200 : 401 },
    );
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function Status() {
  const auth = useAuth();
  return (
    <>
      <output>{auth.me?.teacher.name || "미로그인"}</output>
      <output aria-label="세션 복원 상태">
        {auth.loading ? "복원 중" : "준비 완료"}
      </output>
      <button onClick={() => void auth.logout()}>테스트 로그아웃</button>
    </>
  );
}
function view() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
        <Status />
      </AuthProvider>
    </MemoryRouter>,
  );
}
it("두 로그인 수단만 제공하고 아이모두는 안내만 표시한다", async () => {
  view();
  await userEvent.click(
    screen.getByRole("button", { name: "아이모두계정으로 로그인" }),
  );
  expect(screen.getByText("아이모두 로그인은 준비 중입니다.")).toBeVisible();
  expect(screen.getByText("구글시트 테스트버전")).toBeVisible();
  expect(sent).toBeNull();
  expect(screen.queryByRole("button", { name: /Google|게스트/ })).toBeNull();
});
it("이메일 로그인 폼에서 앞자리 0을 보존하고 오류 후 재시도한다", async () => {
  view();
  await userEvent.click(
    screen.getByRole("button", { name: "이메일로 로그인" }),
  );
  await userEvent.type(screen.getByLabelText("나이스번호"), "0000000001");
  await userEvent.type(screen.getByLabelText("이름"), "다른이름");
  await userEvent.click(screen.getByRole("button", { name: "로그인하기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "나이스번호와 이름을 확인",
  );
  await userEvent.clear(screen.getByLabelText("이름"));
  await userEvent.type(screen.getByLabelText("이름"), "테스트교원01");
  await userEvent.click(screen.getByRole("button", { name: "로그인하기" }));
  expect(
    await screen.findByText("테스트교원01", { selector: "output" }),
  ).toBeVisible();
  expect(sent.neisNumber).toBe("0000000001");
  await userEvent.click(
    screen.getByRole("button", { name: "테스트 로그아웃" }),
  );
  expect(
    await screen.findByText("미로그인", { selector: "output" }),
  ).toBeVisible();
});
it("새로고침 시 서버 세션을 복원한다", async () => {
  signedIn = true;
  view();
  expect(
    await screen.findByText("테스트교원01", { selector: "output" }),
  ).toBeVisible();
});
it("열어 둔 화면에서도 서버가 정한 만료 시각에 개인정보를 지운다", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", async () =>
    Response.json({
      ok: true,
      data: {
        ...me,
        sessionExpiresAt: Date.now() + 1000,
      },
    }),
  );
  view();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(
    screen.getByText("테스트교원01", { selector: "output" }),
  ).toBeVisible();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByText("미로그인", { selector: "output" })).toBeVisible();
});
it("다른 탭에서 세션이 사라진 뒤 돌아오면 다시 확인하고 개인정보를 지운다", async () => {
  signedIn = true;
  view();
  await screen.findByText("테스트교원01", { selector: "output" });
  signedIn = false;
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(screen.getByText("미로그인", { selector: "output" })).toBeVisible();
});
it("초기 세션 조회보다 빠른 로그인 실패 후에도 로딩을 끝낸다", async () => {
  vi.stubGlobal("fetch", async (url: string) =>
    url === "/api/me"
      ? new Promise<Response>(() => {})
      : Response.json(
          {
            ok: false,
            error: {
              code: "UNAUTHORIZED",
              message: "나이스번호와 이름을 확인해 주세요.",
            },
          },
          { status: 401 },
        ),
  );
  view();
  await userEvent.click(
    screen.getByRole("button", { name: "이메일로 로그인" }),
  );
  await userEvent.type(screen.getByLabelText("나이스번호"), "0000000001");
  await userEvent.type(screen.getByLabelText("이름"), "다른이름");
  await userEvent.click(screen.getByRole("button", { name: "로그인하기" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("세션 복원 상태")).toHaveTextContent(
    "준비 완료",
  );
});

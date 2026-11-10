// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../src/auth/AuthProvider";
import MyBadgesPage from "../../src/pages/MyBadgesPage";
import { defs, me } from "../fixtures/badges";

const definitions = defs.map((b) =>
  b.id === "professional"
    ? {
        ...b,
        templateFileId: "template-1",
        templateFileName: "professional_form.hwpx",
      }
    : b,
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function view(fetcher?: typeof fetch) {
  vi.stubGlobal(
    "fetch",
    fetcher ||
      (async () => Response.json({ ok: true, data: { definitions, me } })),
  );
  render(
    <MemoryRouter initialEntries={["/my-badges"]}>
      <AuthProvider>
        <MyBadgesPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}
async function select(id: string) {
  await userEvent.click(
    await screen.findByRole("button", {
      name: `${defs.find((b) => b.id === id)!.name} 상세 보기`,
    }),
  );
}
it("미획득 배지에 다운로드와 제출을 제공하고 마스터와 획득 배지는 제출하지 않는다", async () => {
  view();
  await select("professional");
  expect(
    screen.getByRole("link", { name: "인증서류 양식 다운로드" }),
  ).toHaveAttribute("href", "/api/template?badgeId=professional");
  expect(screen.getByLabelText("인증서류 파일")).toBeEnabled();
  await select("lecturer");
  expect(screen.getByRole("button", { name: "양식 준비 중" })).toBeDisabled();
  expect(screen.getByLabelText("인증서류 파일")).toBeEnabled();
  await select("beginner");
  expect(screen.queryByLabelText("인증서류 파일")).toBeNull();
  await select("master");
  expect(screen.queryByRole("region", { name: "인증서류 제출" })).toBeNull();
});
it("허용하지 않는 파일과 20 MiB 초과 파일은 전송하지 않고 안내한다", async () => {
  view();
  await select("professional");
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(
    screen.getByLabelText("인증서류 파일"),
    new File(["bad"], "proof.exe"),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("HWPX");
  expect(screen.getByRole("button", { name: "서류 제출하기" })).toBeDisabled();
  await user.upload(
    screen.getByLabelText("인증서류 파일"),
    new File([new Uint8Array(20 * 1024 * 1024 + 1)], "proof.pdf", {
      type: "application/pdf",
    }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("20 MiB");
});
it("파일을 청크로 전송하고 완료 응답으로 심사 대기를 표시하며 페이지를 다시 조회하지 않는다", async () => {
  const calls: string[] = [],
    chunks: { offset: number; data: string }[] = [];
  const updated = {
    ...me,
    collections: me.collections.map((r) =>
      r.badgeId === "professional" ? { ...r, status: "서류제출" } : r,
    ),
  };
  view(async (input, init) => {
    const url = String(input);
    calls.push(url);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    let data: unknown = { definitions, me };
    if (url === "/api/submission-start") {
      expect(body).toMatchObject({
        badgeId: "professional",
        fileName: "proof.pdf",
        size: 1048580,
      });
      data = { uploadId: "upload-1", chunkSize: 1048576, received: 0 };
    }
    if (url === "/api/submission-chunk") {
      chunks.push(body);
      data = {
        uploadId: "upload-1",
        received: body.offset + atob(body.data).length,
        complete: chunks.length === 2,
      };
    }
    if (url === "/api/submission-complete")
      data = {
        me: updated,
        submission: {
          badgeId: "professional",
          status: "서류제출",
          fileName: "proof.pdf",
          submittedAt: "2026-11-10T10:00:00Z",
        },
      };
    return Response.json({ ok: true, data });
  });
  await select("professional");
  const bytes = new Uint8Array(1048580);
  bytes.set([37, 80, 68, 70]);
  bytes[1048576] = 65;
  await userEvent.upload(
    screen.getByLabelText("인증서류 파일"),
    new File([bytes], "proof.pdf", { type: "application/pdf" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "서류 제출하기" }));
  expect(await screen.findByText(/제출이 완료되었습니다/)).toBeVisible();
  expect(chunks.map((c) => c.offset)).toEqual([0, 1048576]);
  expect(atob(chunks[0].data).slice(0, 4)).toBe("%PDF");
  expect(atob(chunks[1].data)).toBe("A\0\0\0");
  expect(calls.filter((c) => c === "/api/page")).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "서류제출 (1)" }));
  const cards = within(
    screen.getByRole("group", { name: "배지 목록" }),
  ).getAllByRole("button");
  expect(cards).toHaveLength(1);
  expect(cards[0]).toHaveTextContent("서류제출 · 심사대기");
  expect(screen.getByLabelText("전체 획득 배지")).toHaveTextContent("3 / 7");
  await userEvent.click(screen.getByRole("button", { name: "미획득 (3)" }));
  expect(
    within(screen.getByRole("group", { name: "배지 목록" })).getAllByRole(
      "button",
    ),
  ).toHaveLength(3);
});
it("전송 실패는 미획득 상태를 유지하고 다시 제출할 수 있다", async () => {
  view(async (input) =>
    String(input) === "/api/page"
      ? Response.json({ ok: true, data: { definitions, me } })
      : Response.json(
          {
            ok: false,
            error: { code: "SERVICE_UNAVAILABLE", message: "전송 실패" },
          },
          { status: 503 },
        ),
  );
  await select("professional");
  await userEvent.upload(
    screen.getByLabelText("인증서류 파일"),
    new File(["%PDF-1"], "proof.pdf", { type: "application/pdf" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "서류 제출하기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("전송 실패");
  expect(screen.getByRole("button", { name: "서류 제출하기" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "미획득 (4)" })).toBeVisible();
});
it("로그아웃하면 진행 중인 전송을 취소하고 완료 요청을 보내지 않는다", async () => {
  let chunkSignal: AbortSignal | null = null,
    completed = false;
  view(async (input, init) => {
    if (String(input) === "/api/submission-start")
      return Response.json({
        ok: true,
        data: { uploadId: "upload-1", chunkSize: 1048576, received: 0 },
      });
    if (String(input) === "/api/submission-chunk") {
      chunkSignal = init!.signal!;
      return new Promise((_resolve, reject) =>
        chunkSignal!.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        ),
      );
    }
    if (String(input) === "/api/submission-complete") completed = true;
    return Response.json({ ok: true, data: { definitions, me } });
  });
  await select("professional");
  await userEvent.upload(
    screen.getByLabelText("인증서류 파일"),
    new File(["%PDF-1"], "proof.pdf", { type: "application/pdf" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "서류 제출하기" }));
  await waitFor(() => expect(chunkSignal).not.toBeNull());
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: "jne-badge-logout" }),
    );
  });
  expect(chunkSignal!.aborted).toBe(true);
  expect(completed).toBe(false);
});

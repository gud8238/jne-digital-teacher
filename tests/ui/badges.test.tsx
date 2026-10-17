// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { BadgeProvider } from "../../src/data/BadgeProvider";
import BadgesPage from "../../src/pages/BadgesPage";
import { defs } from "../fixtures/badges";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const view = () =>
  render(
    <MemoryRouter>
      <BadgeProvider>
        <BadgesPage />
      </BadgeProvider>
    </MemoryRouter>,
  );
it("7종 필터와 선택한 배지의 실제 설명·기준을 표시한다", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ ok: true, data: defs }));
  view();
  expect(
    await screen.findAllByRole("button", { name: /상세 보기$/ }),
  ).toHaveLength(7);
  await userEvent.click(screen.getByRole("button", { name: "전문가" }));
  expect(screen.getAllByRole("button", { name: /상세 보기$/ })).toHaveLength(5);
  await userEvent.click(
    screen.getByRole("button", { name: "전문과정 이수자 상세 보기" }),
  );
  const detail = screen.getByRole("region", {
    name: "전문과정 이수자 상세 설명",
  });
  expect(within(detail).getByText("연수와 실천 활동")).toBeVisible();
  await userEvent.click(
    within(detail).getByRole("button", { name: "설명 닫기" }),
  );
  expect(
    screen.getByRole("button", { name: "전문과정 이수자 상세 보기" }),
  ).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "마스터" }));
  expect(screen.getAllByRole("button", { name: /상세 보기$/ })).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "입문" }));
  expect(screen.getAllByRole("button", { name: /상세 보기$/ })).toHaveLength(1);
});
it("연결 오류를 숨기지 않고 재시도로 시트 데이터를 불러온다", async () => {
  let failed = true;
  vi.stubGlobal("fetch", async () =>
    failed
      ? Response.json(
          {
            ok: false,
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "연결을 확인해 주세요.",
            },
          },
          { status: 503 },
        )
      : Response.json({ ok: true, data: defs }),
  );
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent("연결을 확인");
  failed = false;
  await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  expect(
    await screen.findAllByRole("button", { name: /상세 보기$/ }),
  ).toHaveLength(7);
});

// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../src/auth/AuthProvider";
import { BadgeProvider } from "../../src/data/BadgeProvider";
import MyBadgesPage from "../../src/pages/MyBadgesPage";
import GuidePage from "../../src/pages/GuidePage";
import { defs, me, collection } from "../fixtures/badges";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function view(page: "my" | "guide", data: any = me) {
  vi.stubGlobal("fetch", async (url: string) =>
    Response.json({ ok: true, data: url === "/api/badges" ? defs : data }),
  );
  render(
    <MemoryRouter>
      <AuthProvider>
        <BadgeProvider>
          {page === "my" ? <MyBadgesPage /> : <GuidePage />}
        </BadgeProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
it("개인 현황을 계산하고 획득·미획득 필터를 적용한다", async () => {
  view("my");
  expect(await screen.findByLabelText("전체 획득 배지")).toHaveTextContent(
    "3 / 7",
  );
  expect(screen.getByLabelText("전체 달성률")).toHaveTextContent("43%");
  expect(screen.getByLabelText("전문가 획득 배지")).toHaveTextContent("2 / 5");
  expect(
    within(screen.getByRole("group", { name: "배지 목록" }))
      .getAllByRole("button")
      .slice(0, 3)
      .map((button) => button.getAttribute("aria-label")),
  ).toEqual([
    "AI디지털 입문자 상세 보기",
    "에듀테크 전문가 상세 보기",
    "수업연구 실천가 상세 보기",
  ]);
  await userEvent.click(screen.getByRole("button", { name: "획득 (3)" }));
  expect(
    within(screen.getByRole("group", { name: "배지 목록" })).getAllByRole(
      "button",
    ),
  ).toHaveLength(3);
  await userEvent.click(screen.getByRole("button", { name: "미획득 (4)" }));
  expect(
    within(screen.getByRole("group", { name: "배지 목록" })).getAllByRole(
      "button",
    ),
  ).toHaveLength(4);
  await userEvent.click(screen.getByRole("button", { name: "마스터 (1)" }));
  expect(
    within(screen.getByRole("group", { name: "배지 목록" })).getAllByRole(
      "button",
    ),
  ).toHaveLength(1);
});
it("학교·취득일이 비어 있으면 임의 정보를 만들지 않는다", async () => {
  const rows = collection();
  rows[0].earnedAt = null;
  view("my", { teacher: { ...me.teacher, school: null }, collections: rows });
  expect(await screen.findByText("취득일 미등록")).toBeVisible();
  expect(screen.queryByText("테스트학교")).toBeNull();
});
it("마스터 조건 충족과 실제 발급을 구분한다", async () => {
  view("my", {
    ...me,
    collections: collection(["beginner", "edtech", "professional", "research"]),
  });
  expect((await screen.findAllByText("조건 충족 · 발급 전"))[0]).toBeVisible();
  cleanup();
  view("my", { ...me, collections: collection(["master"]) });
  expect((await screen.findAllByText("마스터 달성"))[0]).toBeVisible();
});
it("인증안내가 같은 개인 현황과 미획득 추천을 표시한다", async () => {
  view("guide");
  expect(await screen.findByLabelText("전체 획득 배지")).toHaveTextContent(
    "3 / 7",
  );
  expect(screen.getByLabelText("전문가 달성률")).toHaveTextContent("40%");
  const recommendations = screen.getByRole("region", {
    name: "추천 성장 경로",
  });
  expect(
    within(recommendations).getAllByRole("button", {
      name: /기준 보기|도전 준비하기/,
    }),
  ).toHaveLength(3);
  expect(within(recommendations).queryByText("에듀테크 전문가")).toBeNull();
  await userEvent.click(
    within(recommendations).getByRole("button", {
      name: "전문과정 이수자 도전 준비하기",
    }),
  );
  expect(
    screen.getByRole("region", { name: "전문과정 이수자 상세 설명" }),
  ).toBeVisible();
});

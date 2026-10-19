import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { recommendBadges } from "../../src/domain/badges";

test("실제 시트 텍스트·줄바꿈·추천순위가 운영 페이지에 반영되고 전환마다 POST 한 번만 보낸다", async ({
  page,
}) => {
  test.skip(
    !process.env.VERIFY_ACCOUNTS_FILE ||
      !process.env.LIVE_SHEET_DEFINITIONS_FILE,
    "실제 시트 비교 파일을 지정해야 합니다.",
  );
  const account = JSON.parse(
    readFileSync(process.env.VERIFY_ACCOUNTS_FILE!, "utf8"),
  )[0];
  const rows = JSON.parse(
    readFileSync(process.env.LIVE_SHEET_DEFINITIONS_FILE!, "utf8"),
  );
  const expected = rows
    .slice(1)
    .map((r: string[]) => ({
      id: r[0],
      stage: Number(r[1]),
      name: r[2],
      description: r[3],
      criteria: r[4],
      preparation: r[5],
      recommendationPriority: Number(r[6]),
      criteriaStatus: r[7],
      displayOrder: Number(r[8]),
    }))
    .sort(
      (a: { displayOrder: number }, b: { displayOrder: number }) =>
        a.displayOrder - b.displayOrder,
    );
  const requests: { action: string; method: string }[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/"))
      requests.push({ action: path.slice(5), method: request.method() });
  });
  const response = page.waitForResponse((r) => r.url().endsWith("/api/page"));
  await page.goto("/");
  expect((await (await response).json()).data.definitions).toEqual(expected);
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  await page.getByLabel("나이스번호").fill(account.neisNumber);
  await page.getByLabel("이름", { exact: true }).fill(account.name);
  await page.getByRole("button", { name: "로그인하기", exact: true }).click();
  await expect(page.getByLabel("전체 획득 배지")).toHaveText(
    `${account.earnedCount} / 7`,
  );
  expect(requests.map((r) => r.action)).toEqual(["page", "login"]);
  for (const path of ["/badges", "/guide", "/my-badges"]) {
    const response = page.waitForResponse((r) => r.url().endsWith("/api/page"));
    await page.locator(`a[href="${path}"]:visible`).first().click();
    const data = (await (await response).json()).data;
    expect(data.definitions).toEqual(expected);
    if (path === "/guide") {
      const recommended = recommendBadges(
        data.definitions,
        data.me.collections,
      );
      if (
        recommended.length &&
        !data.me.collections.some(
          (b: { badgeId: string; status: string }) =>
            b.badgeId === "master" && b.status === "획득",
        )
      )
        await expect(
          page.locator(".recommendation-card h3").first(),
        ).toHaveText(recommended[0].name);
    } else {
      const beginner = expected.find(
        (b: { id: string }) => b.id === "beginner",
      );
      if (path === "/my-badges")
        await page
          .getByRole("button", {
            name: `${beginner.name} 상세 보기`,
            exact: true,
          })
          .click();
      const detail = page.getByRole("region", {
        name: `${beginner.name} 상세 설명`,
      });
      await expect(detail).toContainText(beginner.description);
      expect(await detail.locator("p").nth(1).textContent()).toBe(
        beginner.criteria,
      );
      expect(await detail.locator("p").nth(2).textContent()).toBe(
        beginner.preparation,
      );
      await expect(detail.locator("p").nth(1)).toHaveCSS(
        "white-space",
        "pre-line",
      );
    }
  }
  expect(requests.map((r) => r.action)).toEqual([
    "page",
    "login",
    "page",
    "page",
    "page",
  ]);
  expect(requests.every((r) => r.method === "POST")).toBe(true);
  await page
    .locator(".badge-detail")
    .screenshot({ path: "artifacts/live-sheet-multiline-detail.png" });
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "이메일로 로그인", exact: true }),
  ).toBeVisible();
});

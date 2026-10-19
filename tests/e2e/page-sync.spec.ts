import { test, expect } from "@playwright/test";
import { defs, me } from "../fixtures/badges";
for (const width of [390, 1440]) {
  test(`페이지 전환마다 최신 시트 데이터 POST 1회, 로그인 후 중복 조회 없음 ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let version = 0,
      signedIn = false;
    const counts: Record<string, number> = {};
    const definitions = () =>
      defs.map((b) => ({
        ...b,
        description: `시트 설명 ${version}`,
        criteria: `시트 기준 ${version}\n둘째 줄 기준`,
        preparation: `시트 준비 ${version}`,
        recommendationPriority:
          b.id === "coaching" ? -1 : b.recommendationPriority,
      }));
    await page.route("**/api/*", async (route) => {
      const action = new URL(route.request().url()).pathname.split("/").pop()!;
      counts[action] = (counts[action] || 0) + 1;
      expect(route.request().method()).toBe("POST");
      const personal = { ...me, sessionExpiresAt: Date.now() + 14400000 };
      if (action === "login") {
        signedIn = true;
        await route.fulfill({
          json: { ok: true, data: { ...personal, definitions: definitions() } },
        });
      } else if (action === "page")
        await route.fulfill({
          json: {
            ok: true,
            data: {
              definitions: definitions(),
              me: signedIn ? personal : null,
            },
          },
        });
      else throw new Error(`Unexpected API action ${action}`);
    });
    await page.goto("/");
    await expect.poll(() => counts.page).toBe(1);
    await page
      .getByRole("button", { name: "이메일로 로그인", exact: true })
      .click();
    await page.getByLabel("나이스번호").fill("0000000001");
    await page.getByLabel("이름", { exact: true }).fill("테스트교원01");
    await page.getByRole("button", { name: "로그인하기", exact: true }).click();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText("3 / 7");
    expect(counts).toEqual({ page: 1, login: 1 });
    version = 1;
    await page.locator('a[href="/badges"]:visible').first().click();
    const detail = page.getByRole("region", {
      name: "AI디지털 입문자 상세 설명",
    });
    await expect(detail).toContainText("시트 기준 1");
    const criteria = detail.locator("p").nth(1);
    await expect(criteria).toHaveCSS("white-space", "pre-line");
    expect(await criteria.textContent()).toContain("\n둘째 줄 기준");
    await page.getByRole("button", { name: "전문가", exact: true }).click();
    await page
      .getByRole("button", { name: "현장코칭 전문가 상세 보기", exact: true })
      .click();
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(counts).toEqual({ page: 2, login: 1 });
    version = 2;
    await page.locator('a[href="/guide"]:visible').first().click();
    await expect(page.locator(".recommendation-card").first()).toContainText(
      "현장코칭 전문가",
    );
    await expect(page.locator(".recommendation-card").first()).toContainText(
      "시트 준비 2",
    );
    await page
      .getByRole("button", { name: "현장코칭 전문가 도전 준비하기" })
      .click();
    await expect(
      page.getByRole("region", { name: "현장코칭 전문가 상세 설명" }),
    ).toContainText("시트 기준 2");
    expect(counts).toEqual({ page: 3, login: 1 });
    version = 3;
    await page.locator('a[href="/my-badges"]:visible').first().click();
    await expect.poll(() => counts.page).toBe(4);
    await page
      .getByRole("button", { name: "AI디지털 입문자 상세 보기", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "AI디지털 입문자 상세 설명" }),
    ).toContainText("시트 기준 3");
    expect(counts).toEqual({ page: 4, login: 1 });
    await page.screenshot({
      path: `artifacts/page-sync-${width}.png`,
      fullPage: true,
    });
  });
}

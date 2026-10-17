import { test, expect } from "@playwright/test";
import { defs, me } from "../fixtures/badges";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/badges", (route) =>
    route.fulfill({ json: { ok: true, data: defs } }),
  );
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { ...me, sessionExpiresAt: Date.now() + 14400000 },
      },
    }),
  );
});

test("PC·모바일에서 배지소개 필터와 배지함의 명시적 선택을 구분한다", async ({
  page,
}) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/badges");
    await expect(
      page.getByRole("region", { name: "AI디지털 입문자 상세 설명" }),
    ).toBeVisible();
    for (const [filter, detail] of [
      ["전문가", "에듀테크 전문가"],
      ["마스터", "역량 마스터"],
      ["전체", "AI디지털 입문자"],
    ]) {
      await page.getByRole("button", { name: filter, exact: true }).click();
      await expect(
        page.getByRole("region", { name: `${detail} 상세 설명` }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: /상세 설명$/ }),
      ).toHaveCount(1);
    }
    await page.goto("/my-badges");
    await expect(page.getByLabel("전체 획득 배지")).toBeVisible();
    for (const filter of ["전체 (7)", "획득 (3)", "미획득 (4)", "마스터 (1)"]) {
      await page.getByRole("button", { name: filter, exact: true }).click();
      await expect(
        page.getByRole("region", { name: /상세 설명$/ }),
      ).toHaveCount(0);
      await page
        .getByRole("group", { name: "배지 목록" })
        .getByRole("button")
        .first()
        .click();
      await expect(
        page.getByRole("region", { name: /상세 설명$/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: filter, exact: true }).click();
      await expect(
        page.getByRole("region", { name: /상세 설명$/ }),
      ).toHaveCount(0);
    }
  }
});

test("성장 로드맵의 좌우 경계가 하단 두 영역 전체 폭과 일치한다", async ({
  page,
}) => {
  for (const width of [390, 768, 1440, 1908]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/guide");
    await expect(page.getByLabel("전체 획득 배지")).toBeVisible();
    const roadmap = await page
      .locator(".guide-roadmap > .roadmap")
      .boundingBox();
    const columns = await page.locator(".guide-columns").boundingBox();
    expect(Math.abs(roadmap!.x - columns!.x)).toBeLessThan(1);
    expect(Math.abs(roadmap!.width - columns!.width)).toBeLessThan(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect
      .poll(() =>
        page
          .locator(".guide-roadmap img:visible")
          .evaluateAll((images) =>
            images.every(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    if ([390, 1440, 1908].includes(width))
      await page.screenshot({
        path: `artifacts/guide-expanded-${width}.png`,
        fullPage: true,
      });
  }
});

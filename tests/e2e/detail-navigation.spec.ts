import { test, expect } from "@playwright/test";
import { defs, me } from "../fixtures/badges";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/page", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          definitions: defs,
          me: { ...me, sessionExpiresAt: Date.now() + 14400000 },
        },
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

test("배지 체계 폭·내용 크기와 인증안내 카드 높이가 균형을 이룬다", async ({
  page,
}) => {
  for (const width of [390, 768, 1024, 1200, 1440, 1908]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/badges", "/guide"]) {
      await page.goto(path);
      await expect(page.locator(".roadmap")).toHaveCount(1);
      if (path === "/guide")
        await expect(page.getByLabel("전체 획득 배지")).toBeVisible();
      if (width > 700) {
        const panel = await page.locator(".roadmap").boundingBox();
        const reference = await page
          .locator(path === "/badges" ? ".badge-selectors" : ".guide-columns")
          .boundingBox();
        expect(Math.abs(panel!.x - reference!.x)).toBeLessThan(1);
        expect(Math.abs(panel!.width - reference!.width)).toBeLessThan(1);
        const badges = await page
          .locator(".roadmap-stage > .badge-image, .expert-icons .badge-image")
          .evaluateAll((images) =>
            images.map((img) => img.getBoundingClientRect().width),
          );
        expect(badges).toHaveLength(7);
        expect(Math.max(...badges) - Math.min(...badges)).toBeLessThan(1);
        if (width >= 1200) expect(Math.min(...badges)).toBeGreaterThan(120);
        const names = await page
          .locator(
            ".roadmap-stage.beginner > b, .expert-icons span, .roadmap-stage.master > b",
          )
          .evaluateAll((labels) =>
            labels.map((label) => parseFloat(getComputedStyle(label).fontSize)),
          );
        expect(Math.max(...names) - Math.min(...names)).toBeLessThan(1);
        if (path === "/guide" && width > 950) {
          const heights = await page
            .locator(".guide-columns > section")
            .evaluateAll((cards) =>
              cards.map((card) => card.getBoundingClientRect().height),
            );
          expect(Math.abs(heights[0] - heights[1])).toBeLessThan(1);
        }
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect
        .poll(() =>
          page
            .locator(".roadmap img:visible")
            .evaluateAll((images) =>
              images.every(
                (img) =>
                  (img as HTMLImageElement).complete &&
                  (img as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      await page.screenshot({
        path: `artifacts/balanced-${path.slice(1)}-${width}.png`,
        fullPage: true,
      });
    }
  }
});

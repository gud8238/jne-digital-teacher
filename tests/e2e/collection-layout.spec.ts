import { test, expect } from "@playwright/test";
import { defs, me, collection } from "../fixtures/badges";

for (const scenario of ["beginner-earned", "master-earned"] as const) {
  test(`배지함 단계별 세로 배치와 같은 높이: ${scenario}`, async ({ page }) => {
    await page.route("**/api/page", (route) =>
      route.fulfill({
        json: {
          ok: true,
          data: {
            definitions: defs,
            me: {
              ...me,
              sessionExpiresAt: Date.now() + 14400000,
              collections:
                scenario === "master-earned"
                  ? collection(["master"])
                  : me.collections,
            },
          },
        },
      }),
    );
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/my-badges");
      await expect(page.getByLabel("전체 획득 배지")).toBeVisible();
      await expect
        .poll(() =>
          page
            .locator(".collection-image img")
            .evaluateAll((images) =>
              images.every((image) => (image as HTMLImageElement).complete),
            ),
        )
        .toBe(true);
      for (const stage of [1, 3]) {
        const card = page.locator(`.collection-card.stage-${stage}`);
        const earned = stage === (scenario === "beginner-earned" ? 1 : 3);
        await expect(card.locator(".pill")).toHaveText(
          earned ? "획득 완료" : "미획득",
        );
        await expect(card.locator("p")).toHaveText(
          earned ? "2026-10-01" : "나의 다음 도전",
        );
        await expect(card.locator("p")).toBeVisible();
        const image = await card.locator(".collection-image").boundingBox();
        const title = await card.locator("h3").boundingBox();
        expect(title!.y).toBeGreaterThanOrEqual(image!.y + image!.height);
        expect(
          Math.abs(title!.x + title!.width / 2 - image!.x - image!.width / 2),
        ).toBeLessThan(1);
      }
      if (width > 700) {
        const heights = await page
          .locator(".collection-stage")
          .evaluateAll((stages) =>
            stages.map((stage) => stage.getBoundingClientRect().height),
          );
        expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (scenario === "beginner-earned" && [1440, 390].includes(width)) {
        await page.screenshot({
          path: `artifacts/collection-vertical-${width}.png`,
          fullPage: true,
        });
      }
    }
  });
}

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("가로형 시트의 현재 계정으로 배지함·인증안내·소개·계정 전환을 확인한다", async ({
  page,
}) => {
  test.skip(
    !process.env.VERIFY_ACCOUNTS_FILE,
    "현재 시트 계정은 추적 제외된 VERIFY_ACCOUNTS_FILE로 제공합니다.",
  );
  const accounts = JSON.parse(
    readFileSync(process.env.VERIFY_ACCOUNTS_FILE!, "utf8"),
  );
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await page.getByLabel("나이스번호").fill(accounts[0].neisNumber);
    await page.getByLabel("이름", { exact: true }).fill(accounts[0].name);
    await page.getByRole("button", { name: "로그인하기" }).click();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText(
      `${accounts[0].earnedCount} / 7`,
    );
    await expect(
      page.getByRole("group", { name: "배지 목록" }).getByRole("button"),
    ).toHaveCount(7);
    await expect(
      page
        .getByRole("button", { name: "AI디지털 입문자 상세 보기" })
        .locator("p"),
    ).toHaveText("2026-10-01");
    await page.goto("/guide");
    await expect(page.getByLabel("전문가 달성률")).toHaveText(
      `${Math.round((accounts[0].expertCount / 5) * 100)}%`,
    );
    await page.goto("/badges");
    await expect(page.getByRole("button", { name: /상세 보기$/ })).toHaveCount(
      7,
    );
    await page
      .getByRole("button", { name: "수업연구 실천가 상세 보기" })
      .click();
    await expect(
      page.getByRole("region", { name: "수업연구 실천가 상세 설명" }),
    ).toBeVisible();
    await page.goto("/my-badges");
    await page.reload();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText(
      `${accounts[0].earnedCount} / 7`,
    );
    await expect
      .poll(() =>
        page
          .locator(".collection-image img")
          .evaluateAll((images) =>
            images.every((img) => (img as HTMLImageElement).complete),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/wide-sheet-app-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await page.getByLabel("나이스번호").fill(accounts[1].neisNumber);
    await page.getByLabel("이름", { exact: true }).fill(accounts[1].name);
    await page.getByRole("button", { name: "로그인하기" }).click();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText(
      `${accounts[1].earnedCount} / 7`,
    );
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  }
});

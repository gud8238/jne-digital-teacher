import { test, expect } from "@playwright/test";
import { me } from "../fixtures/badges";
for (const width of [360, 390, 768, 1440]) {
  test(`실제 시트 로그인과 네 화면 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "이메일로 로그인" }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/home-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await page.getByLabel("나이스번호").fill("0000000001");
    await page.getByLabel("이름", { exact: true }).fill("테스트교원01");
    await page.getByRole("button", { name: "로그인하기" }).click();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText("3 / 7");
    await expect(page.getByLabel("전체 달성률")).toHaveText("43%");
    await expect(
      page.getByRole("group", { name: "배지 목록" }).getByRole("button"),
    ).toHaveCount(7);
    await expect(page.locator("body")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/collection-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "획득 (3)", exact: true }).click();
    await expect(
      page.getByRole("group", { name: "배지 목록" }).getByRole("button"),
    ).toHaveCount(3);
    await page.goto("/guide");
    await expect(page.getByLabel("전문가 달성률")).toHaveText("40%");
    await expect(page.getByLabel("전체 획득 배지")).toHaveText("3 / 7");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/guide-${width}.png`,
      fullPage: true,
    });
    await page.goto("/badges");
    await expect(page.getByRole("button", { name: /상세 보기$/ })).toHaveCount(
      7,
    );
    await page
      .getByRole("button", { name: "현장코칭 전문가 상세 보기" })
      .click();
    await expect(
      page.getByRole("region", { name: "현장코칭 전문가 상세 설명" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/badges-${width}.png`,
      fullPage: true,
    });
    await page.goto("/my-badges");
    await expect(page.getByLabel("전체 획득 배지")).toHaveText("3 / 7");
    await page.reload();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText("3 / 7");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "이메일로 로그인" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await page.getByLabel("나이스번호").fill("0000000002");
    await page.getByLabel("이름", { exact: true }).fill("테스트교원02");
    await page.getByRole("button", { name: "로그인하기" }).click();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText("0 / 7");
  });
}
test("키보드 로그인·보호 경로 복귀와 큰 글꼴", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/my-badges");
  await expect(
    page.getByRole("button", { name: "이메일로 로그인" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await page.getByLabel("나이스번호").fill("0000000003");
  await page.getByLabel("나이스번호").press("Tab");
  await expect(page.getByLabel("이름", { exact: true })).toBeFocused();
  await page.keyboard.type("테스트교원03");
  await page.getByLabel("이름", { exact: true }).press("Enter");
  await expect(page.getByText("조건 충족 · 발급 전").first()).toBeVisible();
  await page.addStyleTag({
    content: "p,button,a,label,input,h3{font-size:200%!important}",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/large-text-390.png",
    fullPage: true,
  });
});
test("긴 이름을 PC와 모바일에서 가로 넘침 없이 표시한다", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          ...me,
          teacher: {
            ...me.teacher,
            name: "아주긴이름을가진전남광주통합특별시테스트교원선생님",
          },
        },
      },
    }),
  );
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/my-badges");
    await expect(page.getByLabel("전체 획득 배지")).toHaveText("3 / 7");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("인증 후 쿠키가 사라져도 로그아웃하면 개인 화면을 닫는다", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await page.getByLabel("나이스번호").fill("0000000001");
  await page.getByLabel("이름", { exact: true }).fill("테스트교원01");
  await page.getByRole("button", { name: "로그인하기" }).click();
  await expect(page.getByLabel("전체 획득 배지")).toHaveText("3 / 7");
  await context.clearCookies();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "이메일로 로그인" }),
  ).toBeVisible();
  await expect(page.getByLabel("전체 획득 배지")).toHaveCount(0);
});

import { test, expect } from "@playwright/test";
import { me, defs } from "../fixtures/badges";
import { readFileSync } from "node:fs";
function liveAccounts() {
  test.skip(
    !process.env.VERIFY_ACCOUNTS_FILE,
    "현재 시트 계정은 VERIFY_ACCOUNTS_FILE로 제공합니다.",
  );
  return JSON.parse(readFileSync(process.env.VERIFY_ACCOUNTS_FILE!, "utf8"));
}
for (const width of [360, 390, 768, 1440]) {
  test(`실제 시트 로그인과 네 화면 ${width}px`, async ({ page }) => {
    const accounts = liveAccounts();
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
    await page.getByLabel("이름", { exact: true }).fill(accounts[0].name);
    await page.getByLabel("연수원 아이디").fill(accounts[0].trainingId);
    await page.getByRole("button", { name: "로그인하기" }).click();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText(
      `${accounts[0].earnedCount} / 7`,
    );
    await expect(page.getByLabel("전체 달성률")).toHaveText(
      `${Math.round((accounts[0].earnedCount / 7) * 100)}%`,
    );
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
    await page
      .getByRole("button", {
        name: `획득 (${accounts[0].earnedCount})`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("group", { name: "배지 목록" }).getByRole("button"),
    ).toHaveCount(accounts[0].earnedCount);
    await page.goto("/guide");
    await expect(page.getByLabel("전문가 달성률")).toHaveText(
      `${Math.round((accounts[0].expertCount / 5) * 100)}%`,
    );
    await expect(page.getByLabel("전체 획득 배지")).toHaveText(
      `${accounts[0].earnedCount} / 7`,
    );
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
      .getByRole("button", { name: "AI 교육 코칭 전문가 상세 보기" })
      .click();
    await expect(
      page.getByRole("region", { name: "AI 교육 코칭 전문가 상세 설명" }),
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
    await expect(page.getByLabel("전체 획득 배지")).toHaveText(
      `${accounts[0].earnedCount} / 7`,
    );
    await page.reload();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText(
      `${accounts[0].earnedCount} / 7`,
    );
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "이메일로 로그인" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await page.getByLabel("이름", { exact: true }).fill(accounts[1].name);
    await page.getByLabel("연수원 아이디").fill(accounts[1].trainingId);
    await page.getByRole("button", { name: "로그인하기" }).click();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText(
      `${accounts[1].earnedCount} / 7`,
    );
  });
}
test("키보드 로그인·보호 경로 복귀와 큰 글꼴", async ({ page }) => {
  const accounts = liveAccounts();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/my-badges");
  await expect(
    page.getByRole("button", { name: "이메일로 로그인" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await page.getByLabel("이름", { exact: true }).fill(accounts[0].name);
  await page.getByLabel("이름", { exact: true }).press("Tab");
  await expect(page.getByLabel("연수원 아이디")).toBeFocused();
  await page.keyboard.type(accounts[0].trainingId);
  await page.getByLabel("연수원 아이디").press("Enter");
  await expect(page).toHaveURL(/\/my-badges$/);
  await expect(page.getByLabel("전체 획득 배지")).toHaveText(
    `${accounts[0].earnedCount} / 7`,
  );
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
  await page.route("**/api/page", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: {
          definitions: defs,
          me: {
            ...me,
            teacher: {
              ...me.teacher,
              name: "아주긴이름을가진전남광주통합특별시테스트교원선생님",
            },
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
  const accounts = liveAccounts();
  await page.goto("/");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await page.getByLabel("이름", { exact: true }).fill(accounts[0].name);
  await page.getByLabel("연수원 아이디").fill(accounts[0].trainingId);
  await page.getByRole("button", { name: "로그인하기" }).click();
  await expect(page.getByLabel("전체 획득 배지")).toHaveText(
    `${accounts[0].earnedCount} / 7`,
  );
  await context.clearCookies();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "이메일로 로그인" }),
  ).toBeVisible();
  await expect(page.getByLabel("전체 획득 배지")).toHaveCount(0);
});

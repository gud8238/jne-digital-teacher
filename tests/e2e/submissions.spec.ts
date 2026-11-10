import { test, expect } from "@playwright/test";
import { defs, me } from "../fixtures/badges";

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`서류 제출과 심사 대기 반영 ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let pages = 0;
    let finish: (() => void) | undefined;
    const definitions = defs.map((b) =>
      b.id === "professional"
        ? {
            ...b,
            templateFileId: "template-1",
            templateFileName: "professional_form.hwpx",
          }
        : b,
    );
    const updated = {
      ...me,
      collections: me.collections.map((r) =>
        r.badgeId === "professional" ? { ...r, status: "서류제출" } : r,
      ),
    };
    await page.route("**/api/**", async (route) => {
      const action = new URL(route.request().url()).pathname.split("/").pop();
      let data: unknown;
      switch (action) {
        case "page":
          pages++;
          data = { definitions, me };
          break;
        case "submission-start":
          data = { uploadId: "upload-1", chunkSize: 1048576, received: 0 };
          break;
        case "submission-chunk": {
          const body = route.request().postDataJSON();
          data = {
            uploadId: "upload-1",
            received: Buffer.from(body.data, "base64").length,
            complete: true,
          };
          break;
        }
        case "submission-complete":
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          data = {
            me: updated,
            submission: {
              badgeId: "professional",
              status: "서류제출",
              fileName: "proof.pdf",
              submittedAt: "2026-11-10T10:00:00Z",
            },
          };
          break;
        default:
          throw new Error(`Unexpected API: ${action}`);
      }
      await route.fulfill({ json: { ok: true, data } });
    });
    await page.goto("/my-badges");
    await page
      .getByRole("button", {
        name: `${defs.find((b) => b.id === "professional")!.name} 상세 보기`,
      })
      .click();
    await page.screenshot({
      path: `artifacts/submission-panel-${viewport.width}.png`,
      fullPage: true,
    });
    await expect(
      page.getByRole("link", { name: "인증서류 양식 다운로드" }),
    ).toHaveAttribute("href", "/api/template?badgeId=professional");
    await page.getByLabel("인증서류 파일").setInputFiles({
      name: "proof.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nproof"),
    });
    await page.getByRole("button", { name: "서류 제출하기" }).click();
    await expect(page.getByLabel("서류 업로드 진행률")).toHaveAttribute(
      "value",
      "100",
    );
    await expect(page.getByRole("button", { name: "제출 중…" })).toBeDisabled();
    await expect.poll(() => Boolean(finish)).toBe(true);
    finish!();
    await expect(page.getByText(/제출이 완료되었습니다/)).toBeVisible();
    await expect(page.getByLabel("전체 획득 배지")).toHaveText("3 / 7");
    await page.getByRole("button", { name: "서류제출 (1)" }).click();
    await expect(
      page.getByRole("group", { name: "배지 목록" }).getByRole("button"),
    ).toHaveCount(1);
    await expect(
      page.getByText("서류제출 · 심사대기", { exact: true }),
    ).toBeVisible();
    expect(pages).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/submissions-${viewport.width}.png`,
      fullPage: true,
    });
  });
}

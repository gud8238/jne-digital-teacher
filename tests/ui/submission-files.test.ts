// @vitest-environment jsdom
import { expect, it } from "vitest";
import { validateSubmissionFile } from "../../src/lib/submissions";

it.each([
  "application/haansofthwpx",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.hancom.hwpx",
  "application/hwp+zip",
  "",
])("브라우저가 %s로 식별한 HWPX를 선택할 수 있다", (type) => {
  expect(
    validateSubmissionFile(new File(["PK"], "취득 증빙.HWPX", { type })),
  ).toBe("");
});

it("지원하지 않는 확장자와 빈 파일·실제 용량 초과는 계속 거절한다", () => {
  expect(
    validateSubmissionFile(
      new File(["PK"], "archive.zip", { type: "application/hwp+zip" }),
    ),
  ).toContain("HWPX");
  expect(validateSubmissionFile(new File([], "empty.hwpx"))).toContain("내용");
  expect(
    validateSubmissionFile(
      new File([new Uint8Array(20 * 1024 * 1024)], "limit.hwpx"),
    ),
  ).toBe("");
  expect(
    validateSubmissionFile(
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.hwpx"),
    ),
  ).toContain("20Mb");
});

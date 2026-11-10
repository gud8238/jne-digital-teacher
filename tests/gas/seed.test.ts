import { it, expect } from "vitest";
import { seed, headers } from "../../scripts/seed-data.mjs";
it("합성 교원 4명과 각 7개 배지 상태를 일관되게 구성한다", () => {
  expect(seed.badges).toHaveLength(7);
  expect(seed.badges.filter((b: any) => b[1] === 2)).toHaveLength(5);
  expect(seed.teachers.map((r: any) => r[2])).toEqual([
    "jne-test01",
    "jne-test02",
    "jne-test03",
    "jne-test04",
  ]);
  expect(seed.teachers.every((r: any) => r[1].startsWith("테스트교원"))).toBe(
    true,
  );
  expect(seed.collections).toHaveLength(4);
  expect(headers.collections).toHaveLength(15);
  expect(
    seed.teachers.map(
      (t: any) =>
        seed.collections
          .find((r: any) => r[0] === t[0])!
          .slice(1, 8)
          .filter((status: string) => status === "획득").length,
    ),
  ).toEqual([3, 0, 4, 7]);
});

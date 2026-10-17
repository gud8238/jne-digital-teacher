import { pathToFileURL } from "node:url";
import {
  pivotCollections,
  collectionHeaders,
} from "./collection-migration.mjs";
const badges = [
  [
    "beginner",
    1,
    "AI디지털 입문자",
    "AI·디지털 교육을 향한 첫걸음입니다. 배움과 실천을 시작하는 교원의 기초 역량을 기록합니다.",
    "역량체계 심화과정 이수, 인공지능활용 선도교사 이수, 터치교사단 또는 AIEDAP 마스터 교원 등의 활동을 바탕으로 안내합니다.",
    "관련 연수 이수 내역과 교사단 활동 기록을 확인해 보세요.",
    9,
    "잠정 기준",
    1,
  ],
  [
    "edtech",
    2,
    "에듀테크 전문가",
    "에듀테크를 이해하고 교육에 활용하는 전문성을 기록하는 배지입니다.",
    "에듀테크 활용 연수 이수와 연수 강의 활동을 바탕으로 안내합니다. 인정 횟수와 세부 기준은 추후 확정됩니다.",
    "에듀테크 활용 연수 이수 내역과 강의 활동을 정리해 보세요.",
    2,
    "잠정 기준",
    2,
  ],
  [
    "professional",
    2,
    "전문과정 이수자",
    "체계적인 전문 과정 연수로 쌓은 AI·디지털 교육 역량을 기록합니다.",
    "역량체계 전문 과정 연수 이수자를 대상으로 안내합니다.",
    "역량체계 전문 과정의 이수 내역을 확인해 보세요.",
    1,
    "잠정 기준",
    3,
  ],
  [
    "research",
    2,
    "수업연구 실천가",
    "함께 연구하고 수업을 나누며 교육 현장의 변화를 실천하는 전문성을 기록합니다.",
    "연구회 회장·총무 또는 수업공개 활동을 바탕으로 안내합니다. 활동 인정 기간과 세부 기준은 추후 확정됩니다.",
    "연구회 활동과 수업공개 기록을 정리해 보세요.",
    3,
    "잠정 기준",
    4,
  ],
  [
    "lecturer",
    2,
    "강의 선도자",
    "배움의 경험을 동료 교원과 나누고 전문성 확산을 이끄는 활동을 기록합니다.",
    "교육청 각종 지원단 위원 및 창의융합교육원·연수원 출강 활동을 바탕으로 안내합니다.",
    "지원단 참여 내역과 강의 자료·출강 기록을 정리해 보세요.",
    4,
    "잠정 기준",
    5,
  ],
  [
    "coaching",
    2,
    "현장코칭 전문가",
    "학교 현장의 AI·디지털 교육을 지원하고 동료의 성장을 돕는 전문성을 기록합니다.",
    "AI 연구·선도·중점학교 업무 담당, 컨설턴트, 코칭 관련 연수 이수 등의 활동을 바탕으로 안내합니다.",
    "학교 업무·컨설팅·코칭 관련 연수 기록을 확인해 보세요.",
    5,
    "잠정 기준",
    6,
  ],
  [
    "master",
    3,
    "역량 마스터",
    "여러 전문 영역의 경험을 모아 높은 수준의 AI·디지털역량을 갖춘 교원으로 성장합니다.",
    "전문가 배지 3종 이상 획득이 조건입니다. 세부 인증 기준과 신청·심사·발급 절차는 추후 확정됩니다.",
    "전문가 배지 3종 이상을 모아보세요. 조건 충족과 실제 마스터 배지 발급은 구분됩니다.",
    9,
    "잠정 기준",
    7,
  ],
];
const teachers = [1, 2, 3, 4].map((i) => [
  "test-0" + i,
  "000000000" + i,
  "테스트교원0" + i,
  "테스트학교",
  "사용",
]);
const earned = [
  ["beginner", "edtech", "research"],
  [],
  ["beginner", "edtech", "professional", "research"],
  badges.map((b) => b[0]),
];
export const seed = {
  badges,
  teachers,
  collections: pivotCollections(
    teachers.flatMap((t, i) =>
      badges.map((b) => [
        t[0],
        b[0],
        earned[i].includes(b[0]) ? "획득" : "미획득",
        earned[i].includes(b[0]) ? "2026-10-01" : "",
      ]),
    ),
  ),
};
export const headers = {
  teachers: ["teacher_id", "나이스번호", "이름", "소속학교", "활성여부"],
  badges: [
    "badge_id",
    "단계",
    "배지명",
    "설명",
    "취득기준",
    "준비안내",
    "추천우선순위",
    "기준상태",
    "표시순서",
  ],
  collections: collectionHeaders,
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify({ seed, headers }));

import { it, expect } from "vitest";
import { prepareDocumentMigration } from "../../scripts/document-migration.mjs";
const names=["AI 교육 입문자","AI 교육 활용 전문가","AI 교육 연구 실천가","AI 교육 수업 전문가","AI 교육 강의 전문가","AI 교육 코칭 전문가","AI 교육 역량 마스터"];
const ids=["beginner","edtech","research","professional","lecturer","coaching","master"];
const defs=ids.map((id,i)=>({id,name:names[i]}));
const old=["AI디지털 입문자","에듀테크 전문가","수업연구 실천가","전문과정 이수자","강의 선도자","현장코칭 전문가","역량 마스터"];
const teacherHeaders=["teacher_id","나이스번호","이름","소속학교","활성여부"];
const teacherRows=[teacherHeaders,["test-01","00001","교원1","학교","사용"]];
const collectionRows=[["teacher_id",...old,...old.map(n=>n+" 취득일")],["test-01","획득","미획득","미획득","미획득","미획득","미획득","미획득","2026-10-01"]];
const tables=[{name:"Badge_teachers",tableId:"teachers",range:{sheetId:101},columnProperties:teacherHeaders.map(columnName=>({columnName,columnType:"TEXT"}))},{name:"Badge_collections",tableId:"collections",range:{sheetId:103},columnProperties:collectionRows[0].map(columnName=>({columnName,columnType:"TEXT"}))}];
it("교원명 이동과 임시 아이디를 준비하고 상태·날짜는 쓰기 요청에 넣지 않는다",()=>{
  const result=prepareDocumentMigration(teacherRows,collectionRows,tables,defs);
  expect(result.teacherRows[0]).toEqual(["test-01","교원1","jne-test01","학교","사용"]);
  expect(result.collectionRows[0][8]).toBe("2026-10-01");
  const table=(result.requests[2] as any).updateTable.table;
  expect(table.columnProperties[1].dataValidationRule.condition.values.map((v:any)=>v.userEnteredValue)).toContain("서류제출");
  expect(table.columnProperties[7].dataValidationRule.condition.values.map((v:any)=>v.userEnteredValue)).not.toContain("서류제출");
  expect(result.requests.filter((r:any)=>r.updateCells).every((r:any)=>r.updateCells.range.sheetId===101)).toBe(true);
  const rerun=prepareDocumentMigration([result.teacherHeaders,...result.teacherRows],[result.collectionHeaders,...result.collectionRows],tables,defs);
  expect(rerun.teacherRows).toEqual(result.teacherRows);
});
it("관리 중인 열 구조가 바뀌면 임의로 덮어쓰지 않는다",()=>{
  expect(()=>prepareDocumentMigration([["unknown"],...teacherRows.slice(1)],collectionRows,tables,defs)).toThrow();
});

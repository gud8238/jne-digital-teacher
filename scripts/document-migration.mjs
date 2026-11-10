const columnIds = ["beginner","edtech","research","professional","lecturer","coaching","master"];
const oldNames = ["AI디지털 입문자","에듀테크 전문가","수업연구 실천가","전문과정 이수자","강의 선도자","현장코칭 전문가","역량 마스터"];
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const teacherHeaders=["teacher_id","이름","연수원 아이디","소속학교","활성여부"];
export function prepareDocumentMigration(teachers, collections, tables, definitions) {
  if (!Array.isArray(teachers)||teachers.length<2||!Array.isArray(collections)||collections.length<2) throw new Error("변환할 교원/수집현황을 확인해 주세요.");
  const oldTeacher=same(teachers[0].slice(0,5),["teacher_id","나이스번호","이름","소속학교","활성여부"]);
  const newTeacher=same(teachers[0].slice(0,5),teacherHeaders);
  if(!oldTeacher&&!newTeacher) throw new Error("교원 열 구조가 예상과 다릅니다.");
  const teacherRows=teachers.slice(1).filter(r=>r.some(Boolean)).map((r,i)=>[r[0],oldTeacher?r[2]:r[1],oldTeacher?`jne-test${String(i+1).padStart(2,"0")}`:r[2],r[3]||"",r[4]]);
  if(teacherRows.some(r=>!r[0]||!r[1]||!r[2]||!["사용","중지"].includes(r[4])) || new Set(teacherRows.map(r=>r[0])).size!==teacherRows.length ||new Set(teacherRows.map(r=>r[2])).size!==teacherRows.length) throw new Error("교원 ID/이름/연수원 아이디가 누락 또는 중복되었습니다.");
  const names=columnIds.map(id=>definitions.find(b=>b.id===id)?.name);
  if(names.some(n=>!n)) throw new Error("배지 정의가 누락되었습니다.");
  if(collections[0][0]!=="teacher_id" || names.some((name,i)=>![name,oldNames[i]].includes(collections[0][i+1]))) throw new Error("수집현황 배지 열 순서가 예상과 다릅니다.");
  const collectionHeaders=["teacher_id",...names,...names.map(n=>n+" 취득일")];
  const teacherTable=tables.find(t=>t.name==="Badge_teachers"), collectionTable=tables.find(t=>t.name==="Badge_collections");
  if(!teacherTable||!collectionTable) throw new Error("기존 native table을 확인해 주세요.");
  const teacherProps=teacherTable.columnProperties.map((p,i)=>({...p,columnIndex:i,columnName:teacherHeaders[i]}));
  const collectionProps=collectionTable.columnProperties.map((p,i)=>{
    const next={...p,columnIndex:i,columnName:collectionHeaders[i]};
    if(i>0&&i<8) next.dataValidationRule={condition:{type:"ONE_OF_LIST",values:(i===7?["획득","미획득"]:["획득","미획득","서류제출"]).map(userEnteredValue=>({userEnteredValue}))}};
    return next;
  });
  const requests=[
    {updateTable:{table:{tableId:teacherTable.tableId,columnProperties:teacherProps},fields:"columnProperties"}},
    {updateCells:{range:{sheetId:teacherTable.range.sheetId,startRowIndex:1,endRowIndex:1+teacherRows.length,startColumnIndex:1,endColumnIndex:3},rows:teacherRows.map(r=>({values:r.slice(1,3).map(v=>({userEnteredValue:{stringValue:String(v)}}))})),fields:"userEnteredValue"}},
    {updateTable:{table:{tableId:collectionTable.tableId,columnProperties:collectionProps},fields:"columnProperties"}},
    {repeatCell:{range:{sheetId:teacherTable.range.sheetId,startRowIndex:1,endRowIndex:1+teacherRows.length,startColumnIndex:1,endColumnIndex:3},cell:{userEnteredFormat:{numberFormat:{type:"TEXT"}}},fields:"userEnteredFormat.numberFormat"}},
    {updateDimensionProperties:{range:{sheetId:teacherTable.range.sheetId,dimension:"COLUMNS",startIndex:1,endIndex:3},properties:{pixelSize:190},fields:"pixelSize"}},
  ];
  return {requests,teacherRows,teacherHeaders,collectionHeaders,collectionRows:collections.slice(1).map(r=>Array.from({length:15},(_,i)=>r[i]??""))};
}

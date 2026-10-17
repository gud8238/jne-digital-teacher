var BADGE_IDS = ['beginner','edtech','professional','research','lecturer','coaching','master'];
function apiFailure(code) { throw { apiCode: code }; }
function assertData(condition) { if(!condition) apiFailure('DATA_ERROR'); }
function readDefinitions(s) {
  var rows=s.readTable('배지소개');
  var defs=rows.map(function(r){return {id:r.badge_id,stage:Number(r['단계']),name:r['배지명'],description:r['설명'],criteria:r['취득기준'],preparation:r['준비안내'],recommendationPriority:Number(r['추천우선순위']),criteriaStatus:r['기준상태'],displayOrder:Number(r['표시순서'])};});
  assertData(defs.length===7 && new Set(defs.map(function(b){return b.id;})).size===7);
  defs.forEach(function(b){
    assertData(BADGE_IDS.indexOf(b.id)!==-1 && b.stage===(b.id==='beginner'?1:b.id==='master'?3:2));
    ['name','description','criteria','preparation','criteriaStatus'].forEach(function(k){assertData(typeof b[k]==='string' && b[k].trim().length>0);});
    assertData(Number.isFinite(b.recommendationPriority) && Number.isFinite(b.displayOrder));
  });
  return defs.sort(function(a,b){return a.displayOrder-b.displayOrder;});
}
function teacherRows(s) {
  var rows=s.readTable('교원');
  assertData(new Set(rows.map(function(r){return r.teacher_id;})).size===rows.length);
  assertData(new Set(rows.map(function(r){return r['나이스번호'];})).size===rows.length);
  rows.forEach(function(r){assertData(r.teacher_id && r['나이스번호'] && r['이름'] && ['사용','중지'].indexOf(r['활성여부'])!==-1);});
  return rows;
}
function publicTeacher(row) {return {id:row.teacher_id,name:row['이름'],school:row['소속학교']||null};}
function getCollections(s,teacherId) {
  var rows=s.readTable('배지별 수집현황').filter(function(r){return r.teacher_id===teacherId;});
  assertData(rows.length===7 && new Set(rows.map(function(r){return r.badge_id;})).size===7);
  return rows.map(function(r){
    assertData(BADGE_IDS.indexOf(r.badge_id)!==-1 && ['획득','미획득'].indexOf(r['수집현황'])!==-1);
    var date=r['취득일']||null;
    if(date) assertData(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date);
    assertData(r['수집현황']!=='미획득'||date===null);
    return {badgeId:r.badge_id,status:r['수집현황'],earnedAt:date};
  });
}
function handleRequest(p,s) {
  try {
    if(!s.secret || p.key!==s.secret) apiFailure('UNAUTHORIZED');
    if(['badges','login','me','logout'].indexOf(p.action)===-1 || p.teacher_id || p.teacherId) apiFailure('BAD_REQUEST');
    if(p.action==='badges') return {ok:true,data:readDefinitions(s)};
    if(p.action==='login') {
      var neis=typeof p.neisNumber==='string'?p.neisNumber.trim():'';
      var name=typeof p.name==='string'?p.name.trim():'';
      if(!neis||!name||neis.length>128||name.length>80) apiFailure('BAD_REQUEST');
      var row=teacherRows(s).find(function(r){return r['나이스번호']===neis && r['이름']===name && r['활성여부']==='사용';});
      if(!row) apiFailure('UNAUTHORIZED');
      var token=s.newToken(); s.putSession(token,{teacherId:row.teacher_id,expiresAt:s.now()+14400000});
      return {ok:true,data:{teacher:publicTeacher(row),token:token}};
    }
    if(!/^[a-f0-9]{64}$/.test(p.token||'')) apiFailure('UNAUTHORIZED');
    var session=s.getSession(p.token);
    if(!session||session.expiresAt<=s.now()) apiFailure('UNAUTHORIZED');
    if(p.action==='logout') {s.removeSession(p.token);return {ok:true,data:{loggedOut:true}};}
    var teacher=teacherRows(s).find(function(r){return r.teacher_id===session.teacherId&&r['활성여부']==='사용';});
    if(!teacher) apiFailure('UNAUTHORIZED');
    return {ok:true,data:{teacher:publicTeacher(teacher),collections:getCollections(s,teacher.teacher_id)}};
  } catch(e) {
    var code=e.apiCode||'SERVICE_UNAVAILABLE';
    var messages={UNAUTHORIZED:'나이스번호와 이름을 확인하거나 다시 로그인해 주세요.',BAD_REQUEST:'요청 정보를 확인해 주세요.',DATA_ERROR:'배지 데이터가 올바르지 않습니다. 관리자에게 확인해 주세요.',SERVICE_UNAVAILABLE:'데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'};
    return {ok:false,error:{code:code,message:messages[code]||messages.SERVICE_UNAVAILABLE}};
  }
}
function doGet(e) {
  var properties=PropertiesService.getScriptProperties();
  var cache=CacheService.getScriptCache();
  var spreadsheet;
  var result=handleRequest(e&&e.parameter||{}, {
    secret:properties.getProperty('API_SHARED_SECRET'),
    readTable:function(name){
      if(!spreadsheet) spreadsheet=SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID'));
      var sheet=spreadsheet.getSheetByName(name); assertData(!!sheet);
      var values=sheet.getDataRange().getDisplayValues(); var headers=values.shift();
      var expected={'교원':['teacher_id','나이스번호','이름','소속학교','활성여부'],'배지소개':['badge_id','단계','배지명','설명','취득기준','준비안내','추천우선순위','기준상태','표시순서'],'배지별 수집현황':['teacher_id','badge_id','수집현황','취득일']}[name];
      assertData(expected.every(function(h){return headers.indexOf(h)!==-1;})&&new Set(headers).size===headers.length);
      return values.filter(function(row){return row.some(function(v){return v!=='';});}).map(function(row){var obj={};headers.forEach(function(h,i){obj[h]=row[i];});return obj;});
    },
    getSession:function(token){var value=cache.get('session:'+token);return value?JSON.parse(value):null;},
    putSession:function(token,value){cache.put('session:'+token,JSON.stringify(value),14400);},
    removeSession:function(token){cache.remove('session:'+token);},
    now:function(){return Date.now();},
    newToken:function(){return (Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');}
  });
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

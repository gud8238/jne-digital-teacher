import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { defs, collection } from '../fixtures/badges';
export function runtime() {
  const context=vm.createContext({});
  vm.runInContext(readFileSync('gas/Code.js','utf8'), context);
  let clock=Date.parse('2026-10-17T00:00:00Z');
  const sessions = new Map<string, any>();
  const tables: Record<string,any[]> = {
    '교원': [{teacher_id:'test-01','나이스번호':'0000000001','이름':'테스트교원01','소속학교':'테스트학교','활성여부':'사용'}, {teacher_id:'test-02','나이스번호':'0000000002','이름':'테스트교원02','소속학교':'','활성여부':'중지'}],
    '배지소개': defs.map(b=>({badge_id:b.id,'단계':String(b.stage),'배지명':b.name,'설명':b.description,'취득기준':b.criteria,'준비안내':b.preparation,'추천우선순위':String(b.recommendationPriority),'기준상태':b.criteriaStatus,'표시순서':String(b.displayOrder)})),
    '배지별 수집현황': collection().map(r=>({teacher_id:'test-01',badge_id:r.badgeId,'수집현황':r.status,'취득일':r.earnedAt||''})),
  };
  const services={secret:'test-secret',readTable:(name:string)=>tables[name],getSession:(key:string)=>sessions.get(key),putSession:(key:string,v:any)=>sessions.set(key,v),removeSession:(key:string)=>sessions.delete(key),now:()=>clock,newToken:()=> 'a'.repeat(64)};
  return {tables,services,advance:(ms:number)=>{clock+=ms;},call:(params:Record<string,string>)=> context.handleRequest({key:'test-secret',...params},services)};
}

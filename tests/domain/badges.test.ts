import { describe, it, expect } from 'vitest';
import { calculateProgress, recommendBadges, validateBadges, validateMe } from '../../src/domain/badges';
import { defs, collection, me } from '../fixtures/badges';
describe('개인 배지 계산', () => {
  it('입문과 전문가 2종은 전체 43%, 전문가 40%, 마스터까지 1종이다', () => {
    expect(calculateProgress(defs, collection())).toEqual({ earnedCount:3, expertCount:2, overallPercent:43, expertPercent:40, remainingExperts:1, masterState:'in-progress' });
  });
  it('전문가 3종과 실제 마스터 발급을 구분한다', () => {
    expect(calculateProgress(defs, collection(['edtech','professional','research'])).masterState).toBe('eligible');
    expect(calculateProgress(defs, collection(['master'])).masterState).toBe('awarded');
    expect(calculateProgress(defs, collection([])).overallPercent).toBe(0);
  });
  it('미획득 전문가를 우선순위에 따라 추천한다', () => {
    expect(recommendBadges(defs, collection()).map(b => b.id)).toEqual(['professional','lecturer','coaching']);
  });
});
describe('서버 데이터 검증', () => {
  it('정상 7종과 개인정보 응답을 읽는다', () => {
    expect(validateBadges(defs)).toHaveLength(7); expect(validateMe(me).teacher.name).toBe('테스트교원01');
  });
  it.each(['missing','duplicate','unknown','status','date'])('불완전한 수집행 %s를 미획득으로 숨기지 않는다', mode => {
    const rows: any[] = collection();
    if(mode==='missing') rows.pop(); if(mode==='duplicate') rows[6]=rows[0];
    if(mode==='unknown') rows[0].badgeId='other'; if(mode==='status') rows[0].status='완료';
    if(mode==='date') rows[0].earnedAt='2026-02-31';
    expect(() => validateMe({...me,collections:rows})).toThrow();
  });
  it('중복 배지 정의와 잘못된 단계는 거절한다', () => {
    expect(()=>validateBadges([...defs.slice(0,6),defs[0]])).toThrow();
    expect(()=>validateBadges(defs.map((b,i)=>i===0?{...b,stage:2}:b))).toThrow();
  });
});

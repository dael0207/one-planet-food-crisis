import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,COUNTRY_IDS} from '../dist/engine.mjs';
import {renderTreatyForm,renderTreatyTerms,renderTreatyLedger,renderTreatyResults,renderTreatyHistory,renderBreakReview} from '../dist/treaty-ui.mjs';

test('treaty composer states time, first execution and per-quarter versus whole-term obligations',()=>{
 const state=createGame('lumen'),html=renderTreatyForm(state,{targetId:'nord',kind:'trade_buy',food:4,money:8,duration:8});
 assert.equal((html.match(/<option value="(?:lumen|nord|cera|altia|marin|solis)"/g)??[]).length,5);
 for(const name of ['targetId','kind','duration','food','money'])assert.ok(html.includes(`name="${name}"`));
 assert.ok(html.includes('조건을 편집하거나 파기 검토 화면을 여는 동안에는 시간이 흐르지 않습니다'));
 assert.ok(html.includes('이번 분기부터 이행'));
 assert.ok(html.includes('분기별 약속'));
 assert.ok(html.includes('전체 8분기를 모두 이행하면 식량 32·국고 64억'));
 assert.ok(html.includes('양국 관계'));
 assert.ok(html.includes('약속 신뢰도'));
 assert.ok(html.includes('id="send-treaty"'));
 assert.equal(COUNTRY_IDS.length,6);
});

test('mutual food-support alliance copy has a real trigger and never implies military aid or fake transfers',()=>{
 const terms=renderTreatyTerms({targetId:'solis',kind:'alliance',food:5,money:2,duration:12});
 assert.ok(terms.includes('식량이 35 미만이면'));
 assert.ok(terms.includes('국고가 25억 미만일 때만'));
 assert.ok(terms.includes('대기 분기에는 자원이 이동하지 않습니다'));
 assert.ok(!terms.includes('군사'));
 assert.ok(!terms.includes('매 분기 식량 5 제공'));
});

test('invalid decimal terms remain invalid instead of silently reverting to defaults',()=>{
 const state=createGame('lumen');
 const html=renderTreatyForm(state,{targetId:'nord',kind:'trade_buy',food:1.5,money:8,duration:4});
 assert.ok(html.includes('조건을 조정해 주세요'));
 assert.match(html,/id="send-treaty"[^>]+disabled/);
});

test('active ledger exposes fulfilled and breached counts, remaining executions and a guarded break review',()=>{
 const state=createGame('lumen');state.turn=3;state.treaties=[{id:'treaty-1',playerId:'lumen',targetId:'nord',kind:'trade_buy',food:4,money:8,duration:8,status:'active',startTurn:1,endTurn:9,fulfilled:2,breaches:1,streak:0,lastOutcome:'노르드가 식량 4를 보냈습니다.',events:[]}];
 const decision=renderTreatyLedger(state,{phase:'decision'});
 assert.ok(decision.includes('5회 남음'));
 assert.ok(decision.includes('2회'));
 assert.ok(decision.includes('1회'));
 assert.ok(decision.includes('연속 불이행'));
 assert.ok(decision.includes('우리 약속 신뢰도'));
 assert.ok(!decision.includes('[object Object]'));
 assert.ok(decision.includes('data-action="review-treaty-break"'));
 assert.ok(decision.includes('data-id="treaty-1"'));
 const paused=renderTreatyLedger(state,{phase:'result'});
 assert.ok(paused.includes('결과 확인 후 제안 가능'));
 assert.ok(paused.includes('review-treaty-break'));
 assert.match(paused,/review-treaty-break[^>]+disabled/);
});

test('quarter result separates promise from actual transfer and names responsibility and observers',()=>{
 const state=createGame('lumen');state.treaties=[{id:'treaty-2',playerId:'lumen',targetId:'cera',kind:'trade_sell',food:6,money:10,duration:4,status:'active',startTurn:1,endTurn:5,fulfilled:0,breaches:1,events:[]}];
 state.lastTreatyEvents=[{treatyId:'treaty-2',targetId:'cera',turn:2,type:'breach',text:'루멘이 약속한 물량 중 식량 2만 보냈습니다.',actorId:'lumen',promisedFood:6,promisedMoney:10,food:2,money:4,relationBefore:49,relationAfter:45,reliabilityBefore:70,reliabilityAfter:64,observers:[{countryId:'nord',text:'루멘의 이행 능력을 의심합니다.',delta:-2}]}];
 const html=renderTreatyResults(state);
 assert.ok(html.includes('책임 국가 · 루멘'));
 assert.ok(html.includes('식량 6 · 국고 10억'));
 assert.ok(html.includes('식량 2 · 국고 4억'));
 assert.ok(html.includes('양국 관계 49'));
 assert.ok(html.includes('약속 신뢰도 70'));
 assert.ok(html.includes('노르드'));
 assert.ok(html.includes('-2'));
});

test('alliance standby explicitly records no trigger without inventing fulfillment',()=>{
 const state=createGame('marin');state.treaties=[{id:'ally-1',playerId:'marin',targetId:'solis',kind:'alliance',food:4,money:1,duration:4,status:'active',startTurn:1,endTurn:5,fulfilled:0,breaches:0,events:[]}];
 state.lastTreatyEvents=[{treatyId:'ally-1',targetId:'solis',turn:2,type:'standby',text:'양국 모두 지원 발동선 위에 있습니다.'}];
 const html=renderTreatyResults(state);
 assert.ok(html.includes('식량 35 이상'));
 assert.ok(html.includes('가상의 이행 횟수로 계산되지 않습니다'));
 assert.ok(!html.includes('실제 이동'));
});

test('break review presents exact relationship and reliability consequences before replayable confirmation',()=>{
 const state=createGame('altia');state.turn=6;state.treaties=[{id:'treaty-break',playerId:'altia',targetId:'cera',kind:'trade_buy',food:3,money:7,duration:12,status:'active',startTurn:2,endTurn:14,fulfilled:5,breaches:0,events:[]}];
 const html=renderBreakReview(state,'treaty-break');
 assert.ok(html.includes('파기 검토 화면을 여는 것만으로는'));
 assert.ok(html.includes('양국 관계'));
 assert.ok(html.includes('우리나라 약속 신뢰도'));
 assert.equal((html.match(/-12/g)??[]).length,2);
 assert.ok(html.includes('각 -2'));
 assert.ok(html.includes('노르드'));
 assert.ok(html.includes('마린'));
 assert.ok(html.includes('솔리스'));
 assert.ok(html.includes('data-action="confirm-treaty-break"'));
 assert.ok(html.includes('data-id="treaty-break"'));
 assert.ok(html.includes('한 분기 진행'));
});

test('history distinguishes normal completion, breach count and voluntary break',()=>{
 const state=createGame('solis');state.treaties=[
  {id:'done',playerId:'solis',targetId:'marin',kind:'trade_buy',status:'completed',fulfilled:4,breaches:0,startTurn:1},
  {id:'broken',playerId:'solis',targetId:'nord',kind:'alliance',status:'broken',fulfilled:1,breaches:2,startTurn:5},
 ];
 const html=renderTreatyHistory(state);
 assert.ok(html.includes('정상 완료'));
 assert.ok(html.includes('자발적 파기'));
 assert.ok(html.includes('4회 이행 · 0회 불이행'));
 assert.ok(html.includes('1회 이행 · 2회 불이행'));
});

test('completed treaty with breaches is described as a period end with missed obligations',()=>{
 const state=createGame('nord');state.treaties=[{id:'mixed',playerId:'nord',targetId:'cera',kind:'trade_buy',status:'completed',fulfilled:3,breaches:1,startTurn:2}];
 const html=renderTreatyHistory(state);
 assert.ok(html.includes('기간 종료(미이행 있음)'));
 assert.ok(!html.includes('정상 완료'));
});

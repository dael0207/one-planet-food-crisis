import test from 'node:test';
import assert from 'node:assert/strict';

import {advanceTurn, createGame, jointCommand} from '../dist/engine.mjs';
import {createForeignSites} from '../dist/foreign-sites.mjs';
import {mapConsequences, renderMapConsequences, updateMapConsequences} from '../dist/map-consequences.mjs';

const quiet={networkStartTurn:999,policyStartTurn:999,objectiveStartTurn:999,worldGoalStartTurn:999,conflictStartTurn:999,mediationStartTurn:999,peaceOfferStartTurn:999,peaceComplianceStartTurn:999,peaceResponseStartTurn:999,foreignSiteStartTurn:1,jointStartTurn:1};
const joint={targetId:'nord',kind:'farm',capital:20,share:25,duration:8};

test('opening state has no manufactured changes and the projection is immutable',()=>{
 const state=createGame('lumen',quiet),before=structuredClone(state);
 assert.deepEqual(mapConsequences(state),[]);
 assert.deepEqual(state,before);
 assert.equal(renderMapConsequences(state,'decision'),'');
});

test('real engine records become exact domestic construction and joint-investment consequences',()=>{
 const started=advanceTurn(createGame('marin',quiet),'site:farm:upgrade');
 started.history.at(-1).siteOperations[0].text='표시 문구에는 비용 999억이라고 써도 권한이 없습니다.';
 const site=mapConsequences(started);
 assert.equal(site[0].countryId,'marin');
 assert.equal(site[0].siteKind,'farm');
 assert.equal(site[0].title,'마린 지역 농경지 착공');
 assert.match(site[0].detail,/국고 12억 지출/);
 assert.match(site[0].detail,/2031년 3분기 완공 예정/);

 const invested=advanceTurn(createGame('lumen',quiet),jointCommand(joint));
 const foreign=mapConsequences(invested);
 assert.equal(foreign[0].countryId,'nord');
 assert.equal(foreign[0].siteKind,'farm');
 assert.equal(foreign[0].title,'노르드 공동 농경지 착공');
 assert.match(foreign[0].detail,/투자금 20억/);
});

test('joint expansion names the existing partner facility level instead of claiming a generic first build',()=>{
 const state=createGame('lumen',quiet);state.foreignSites=createForeignSites('lumen');state.foreignSites.nord.farm.level=1;
 const expanded=advanceTurn(state,jointCommand(joint)),change=mapConsequences(expanded)[0];
 assert.equal(change.title,'노르드 공동 농경지 2단계 시설 확장');
 assert.match(change.detail,/2031년 3분기 완공 예정/);
});

test('actual joint settlement outranks status changes without inventing shipment events',()=>{
 let state=advanceTurn(createGame('lumen',quiet),jointCommand(joint));
 state=advanceTurn(state,'maintain');
 state=advanceTurn(state,'maintain');
 state=advanceTurn(state,'maintain');
 const before=structuredClone(state),changes=mapConsequences(state);
 assert.equal(changes[0].title,'노르드 공동 농경지 식량 배분');
 assert.equal(changes[0].detail,'식량 +1 · 실제 배분 완료');
 assert.equal(changes[0].siteKind,'farm');
 assert.deepEqual(state,before);
});

test('sanction changes name the recorded pair and ranked output is capped at three',()=>{
 const state=createGame('lumen',quiet);
 state.turn=7;
 state.history=[{turn:7,playerId:'lumen',development:{started:[{dueTurn:9}],completed:[]},siteDevelopment:{started:[{countryId:'lumen',siteKind:'port',level:1,dueTurn:9}],completed:[{countryId:'lumen',siteKind:'city',level:1,dueTurn:7}]},jointInvestmentEvents:[
  {source:'joint_investment',operation:'suspended',countryId:'nord',targetId:'lumen',kind:'farm',food:0,money:0,reason:'무역 제재'},
  {source:'joint_investment',operation:'resumed',countryId:'cera',targetId:'lumen',kind:'port',food:0,money:0,reason:'관계 회복'},
 ],worldActions:[{source:'goal_conflict',type:'sanction',countryId:'nord',targetId:'lumen',text:'거래 중단'}]}];
 const changes=mapConsequences(state);
 assert.equal(changes.length,3);
 assert.equal(changes[0].title,'노르드 공동 농경지 공급 중단');
 assert.ok(changes.some(item=>item.title==='노르드–루멘 교역 제재'));
});

test('foreign and player re-sanctions use the same named-pair projection',()=>{
 const state=createGame('lumen',quiet);state.turn=8;state.history=[{turn:8,playerId:'lumen',worldActions:[
  {source:'peace_response',type:'peace_response_sanction',countryId:'cera',targetId:'lumen',text:'타국 상업 제재 시작'},
  {source:'peace_compliance',type:'accord_sanctioned',countryId:'lumen',targetId:'nord',text:'합의 위반 재제재 시작'},
 ]}];
 const changes=mapConsequences(state);
 assert.deepEqual(new Set(changes.map(item=>item.title)),new Set(['세라–루멘 교역 제재','루멘–노르드 교역 제재']));
});

test('a real engine blockade becomes the exact named sanction consequence',()=>{
 const state=createGame('lumen',{...quiet,conflictStartTurn:1});
 state.goalConflicts=[{id:'map-blockade',status:'active',type:'trade_sanctions',initiatorId:'nord',targetId:'lumen',sanctionMembers:['nord'],responseMembers:['lumen'],formedTurn:0,startTurn:1,endTurn:5,duration:4,playerStance:null,stanceTurn:null,events:[],reason:'항만 봉쇄'}];
 const next=advanceTurn(state,'maintain'),change=mapConsequences(next)[0];
 assert.equal(change.title,'루멘–노르드 교역 제재');
 assert.equal(change.detail,'무역 제재로 루멘 → 노르드 기존 공급이 이번 분기 중단됐습니다.');
});

test('ordinary actual player food trade keeps the map consequential without inventing a route',()=>{
 const state=createGame('lumen',quiet);state.turn=6;state.history=[{turn:6,playerId:'lumen',worldActions:[{source:'foreign_site',type:'trade',operation:'trade',kind:'port',countryId:'marin',targetId:'lumen',shipmentFromId:'marin',shipmentToId:'lumen',food:3,money:3,text:'마린 항만 → 루멘: 식량 3 선적 · 대금 3억 이전.'}]}];
 const changes=mapConsequences(state);
 assert.deepEqual(changes.map(({countryId,siteKind,title,detail})=>({countryId,siteKind,title,detail})),[{countryId:'marin',siteKind:'port',title:'마린 → 루멘 식량 유입',detail:'식량 +3 · 실제 이동 완료'}]);
});

test('real autonomous port shipments surface as three actual map changes',()=>{
 let state=createGame('lumen');for(let index=0;index<3;index++)state=advanceTurn(state,'maintain');
 state=advanceTurn(state,`stance:${state.goalConflicts[0].id}:neutral`);
 const changes=mapConsequences(state);
 assert.equal(changes.length,3);
 assert.ok(changes.every(item=>item.kind==='food-trade'&&item.siteKind==='port'&&item.detail==='식량 +2 · 실제 이동 완료'));
});

test('rendering distinguishes this completed quarter from the previous completed quarter and escapes records',()=>{
 const state=createGame('lumen',quiet);state.turn=4;state.history=[{turn:4,playerId:'lumen',jointInvestmentEvents:[{source:'joint_investment',operation:'suspended',countryId:'nord',targetId:'lumen',kind:'farm',reason:'<script>중단</script>',food:0,money:0}],worldActions:[]}];
 const result=renderMapConsequences(state,'result'),decision=renderMapConsequences(state,'decision');
 assert.match(result,/이번 완료 분기 · 2031년 4분기/);
 assert.match(decision,/지난 완료 분기 · 2031년 4분기/);
 assert.doesNotMatch(result,/<script>/);
 assert.match(result,/<details><summary>실제 영향 보기<\/summary><p>&lt;script&gt;중단&lt;\/script&gt;<\/p><\/details>/);
 assert.match(result,/data-action="focus-map-change"[^>]+data-change-id="4:joint-suspended:nord:farm:0"[^>]+data-country="nord"[^>]+data-site="farm"/);
});

test('map updater clears stale markers and outlines only recorded country and site targets',()=>{
 const stale={dataset:{mapConsequence:'old'},classList:{removed:[],remove(value){this.removed.push(value);}}};
 const land={dataset:{},classList:{added:[],add(value){this.added.push(value);}}};
 const site={dataset:{},classList:{added:[],add(value){this.added.push(value);}}};
 const svg={dataset:{},querySelectorAll(selector){return selector==='[data-map-consequence]'?[stale]:[];},querySelector(selector){if(selector==='.land[data-country="nord"]')return land;if(selector==='.map-site-target[data-country="nord"][data-site="farm"]')return site;return null;}};
 const state=createGame('lumen',quiet);state.turn=2;state.history=[{turn:2,playerId:'lumen',jointInvestmentEvents:[{source:'joint_investment',operation:'suspended',countryId:'nord',targetId:'lumen',kind:'farm',reason:'제재',food:0,money:0}],worldActions:[]}];
 const projected=updateMapConsequences(svg,state,'result');
 assert.equal(projected.length,1);
 assert.equal(stale.dataset.mapConsequence,undefined);
 assert.deepEqual(stale.classList.removed,['is-map-consequence']);
 assert.equal(land.dataset.mapConsequence,'1');
 assert.equal(site.dataset.mapConsequence,'1');
 assert.deepEqual(land.classList.added,['is-map-consequence']);
 assert.deepEqual(site.classList.added,['is-map-consequence']);
});

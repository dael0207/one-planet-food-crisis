import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS,advanceTurn,createGame,getAction,pendingPeaceOffers,peaceCounterCommand} from '../dist/engine.mjs';
import {quarterPriority,renderQuarterPriority} from '../dist/quarter-priority.mjs';

const openingCommands={
 lumen:'balanced',nord:'secure_imports',cera:'export_push',altia:'research',marin:'expand_routes',solis:'resilience',
};

test('all six opening countries receive one executable objective direction without mutation',()=>{
 for(const playerId of COUNTRY_IDS){
  const state=createGame(playerId),before=structuredClone(state),priority=quarterPriority(state);
  assert.equal(priority.kind,'objective',playerId);
  assert.equal(priority.commandId,openingCommands[playerId],playerId);
  assert.ok(getAction(state,priority.commandId),playerId);
  assert.match(priority.reason,/국가 목표/);
  assert.deepEqual(state,before,playerId);
 }
});

test('pre-joint-investment defaults still derive a priority without adding state',()=>{
 const state=createGame('lumen',{jointStartTurn:99,foreignSiteStartTurn:99});
 delete state.jointInvestments;
 delete state.foreignSites;
 const before=JSON.stringify(state),priority=quarterPriority(state);
 assert.equal(priority.commandId,'balanced');
 assert.equal(JSON.stringify(state),before);
});

test('immediate food danger outranks the long-term objective and stays executable with depleted resources',()=>{
 const state=createGame('solis');
 state.countries.solis.food=34;
 state.countries.solis.treasury=0;
 const before=structuredClone(state),priority=quarterPriority(state);
 assert.equal(priority.kind,'resource');
 assert.equal(priority.commandId,'maintain');
 assert.ok(getAction(state,priority.commandId));
 assert.match(priority.reason,/식량 34.+위험선 35/);
 assert.deepEqual(state,before);
});

test('canonical food boundary is critical below 35, not merely strained at 35 or 37',()=>{
 for(const food of [35,37]){
  const state=createGame('lumen');state.countries.lumen.food=food;
  assert.notEqual(quarterPriority(state).kind,'resource',`food ${food}`);
 }
 const critical=createGame('lumen');critical.countries.lumen.food=34;
 assert.equal(quarterPriority(critical).kind,'resource');
});

test('extreme living costs point to an affordable current price response',()=>{
 const state=createGame('nord');
 state.countries.nord.price=160;
 const priority=quarterPriority(state);
 assert.equal(priority.kind,'resource');
 assert.equal(priority.commandId,'subsidy');
 assert.match(priority.reason,/생활물가 160/);
});

test('a request is urgent only while a reply command can still execute this decision',()=>{
 const state=createGame('lumen'),request=state.requests[0];
 state.turn=request.expiresTurn-1;
 const urgent=quarterPriority(state);
 assert.equal(urgent.kind,'deadline');
 assert.equal(urgent.requestId,request.id);
 assert.equal(urgent.countryId,request.fromId);
 assert.ok(urgent.commandId&&getAction(state,urgent.commandId));
 state.turn=request.expiresTurn;
 assert.notEqual(quarterPriority(state).kind,'deadline');
});

test('natural peace and mediation counters use their exact final executable decision',()=>{
 // Preserve the V27 natural offer timeline; V29 strategy can legitimately change the final reply.
 const run=(state,count)=>{for(let index=0;index<count;index++)state=advanceTurn(state,'maintain');return state;};
 let peace=run(createGame('lumen',{foreignSiteStartTurn:999,foreignStrategyStartTurn:999}),4),offer=pendingPeaceOffers(peace)[0];
 peace=advanceTurn(peace,'maintain');
 const peacePriority=quarterPriority(peace);
 assert.equal(peacePriority.kind,'deadline');
 assert.equal(peacePriority.commandId,`peace-reply:${offer.id}:accept`);
 assert.ok(getAction(peace,peacePriority.commandId));
 const expiredPeace=advanceTurn(peace,'maintain');
 assert.notEqual(quarterPriority(expiredPeace).kind,'deadline');

 let mediation=run(createGame('lumen',{foreignSiteStartTurn:999,foreignStrategyStartTurn:999}),4);offer=pendingPeaceOffers(mediation)[0];
 const counter=peaceCounterCommand({offerId:offer.id,conflictId:offer.conflictId,goal:'relief',condition:'mutual',food:0,money:0});
 mediation=advanceTurn(mediation,counter);
 const record=mediation.mediations.at(-1),mediationPriority=quarterPriority(mediation);
 assert.equal(mediationPriority.commandId,`mediate-accept:${record.id}`);
 assert.ok(getAction(mediation,mediationPriority.commandId));
 const expiredMediation=advanceTurn(mediation,'maintain');
 assert.notEqual(quarterPriority(expiredMediation).commandId,`mediate-accept:${record.id}`);
});

test('an actual suspended joint supply points to its foreign facility without inventing a command',()=>{
 const state=createGame('lumen');
 state.requests=[];
 state.jointInvestments=[{id:'joint-lumen-nord-farm-1',targetId:'nord',kind:'farm',status:'suspended',dueTurn:2,endTurn:9,lastReason:'무역 제재가 계속되어 정산 중단'}];
 const priority=quarterPriority(state);
 assert.deepEqual(priority,{kind:'supply',title:'노르드 공동 농경지 공급 중단',reason:'무역 제재가 계속되어 정산 중단',actionLabel:'중단 원인 확인',commandId:null,view:'map',countryId:'nord',siteKind:'farm',requestId:null});
});

test('a project completing on the next executed quarter exposes its real site target',()=>{
 const state=createGame('altia');
 state.requests=[];
 state.projects=[{type:'site',countryId:'altia',siteKind:'port',level:1,dueTurn:1}];
 const priority=quarterPriority(state);
 assert.equal(priority.kind,'construction');
 assert.equal(priority.countryId,'altia');
 assert.equal(priority.siteKind,'port');
 assert.match(priority.reason,/다음 결정과 함께.+완공/);
});

test('an unaffordable objective requirement falls back without claiming direct progress',()=>{
 const state=createGame('nord');
 state.requests=[];
 state.objectives.completed=[{stage:1,turn:0,title:'stage',unlockId:'mandate_nord_1'}];
 state.countries.nord.treasury=0;
 state.countries.nord.food=50;
 state.countries.nord.price=120;
 state.countries.nord.trust=0;
 const priority=quarterPriority(state);
 assert.equal(priority.kind,'policy');
 assert.equal(priority.commandId,'maintain');
 assert.ok(!priority.reason.includes('직접 진전'));
});

test('the compact priority line renders only during decision and escapes state-backed copy',()=>{
 const state=createGame('lumen');
 state.requests=[];
 state.jointInvestments=[{id:'x',targetId:'nord',kind:'port',status:'suspended',dueTurn:2,endTurn:9,lastReason:'<img src=x onerror=alert(1)>'}];
 const html=renderQuarterPriority(state);
 assert.match(html,/class="quarter-priority"/);
 assert.match(html,/data-action="inspect-priority"/);
 assert.ok(!html.includes('data-command-id'));
 assert.match(html,/<button type="button"/);
 assert.ok(!html.includes('<img'));
 assert.equal(renderQuarterPriority(state,'result'),'');
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {initialCountries} from '../dist/country-data.mjs';
import {marketContext} from '../dist/foreign-diplomacy.mjs';
import {prepareForeignStrategies,strategyActive} from '../dist/foreign-strategy.mjs';
import {advanceTurn,createGame} from '../dist/engine.mjs';
import {getAction} from '../dist/engine.mjs';
import {jointCommand,previewJointInvestment} from '../dist/joint-investments.mjs';
import {previewProposal} from '../dist/negotiations.mjs';
import {previewTreaty} from '../dist/treaties.mjs';

const baseState=()=>({
 playerId:'lumen',turn:1,foreignStrategyStartTurn:1,countries:initialCountries(),relations:{'lumen:nord':73},history:[],
});

test('strategy activation is explicit and inactive preparation leaves legacy state untouched',()=>{
 const before=baseState();delete before.foreignStrategyStartTurn;const next=structuredClone(before),actions=[];
 prepareForeignStrategies(next,before,{id:'maintain',name:'기존 정책 유지'},actions);
 assert.equal(strategyActive(next),false);assert.deepEqual(next,before);assert.deepEqual(actions,[]);
});

test('each foreign actor selects a resource-sensitive national mode and records only real changes',()=>{
 const before=baseState();before.countries.nord.food=24;before.countries.cera.food=88;before.countries.altia.treasury=86;before.countries.marin.treasury=12;before.countries.solis.food=38;
 const next=structuredClone(before),actions=[];prepareForeignStrategies(next,before,{id:'maintain',name:'기존 정책 유지'},actions);
 assert.deepEqual(Object.keys(next.foreignStrategies),['nord','cera','altia','marin','solis']);
 assert.equal(next.foreignStrategies.nord.mode,'food');assert.equal(next.foreignStrategies.cera.mode,'trade');assert.equal(next.foreignStrategies.altia.mode,'development');assert.equal(next.foreignStrategies.marin.mode,'fiscal');assert.equal(next.foreignStrategies.solis.mode,'resilience');
 assert.equal(actions.length,5);assert.ok(actions.every(item=>item.source==='foreign_strategy'&&item.type==='strategy'&&item.turn===1));
});

test('strategy hysteresis keeps a recent mode until a genuine crisis overrides it',()=>{
 const before=baseState();before.foreignStrategies={nord:{mode:'trade',label:'교역 확대',reason:'기존',sinceTurn:1,lastTurn:1,previousMode:null,previousAction:null,trend:{food:0,treasury:0},posture:'neutral',postureReason:'',postureUntil:0,observedPolicy:null,lastMetrics:{food:52,treasury:72},importStreak:0}};
 before.turn=2;before.countries.nord.food=49;const steady=structuredClone(before);prepareForeignStrategies(steady,before,{id:'maintain',name:'기존 정책 유지'},[]);assert.equal(steady.foreignStrategies.nord.mode,'trade');assert.equal(steady.foreignStrategies.nord.sinceTurn,1);
 const crisis=structuredClone(steady);crisis.turn=3;crisis.countries.nord.food=20;prepareForeignStrategies(crisis,steady,{id:'maintain',name:'기존 정책 유지'},[]);assert.equal(crisis.foreignStrategies.nord.mode,'food');assert.equal(crisis.foreignStrategies.nord.previousMode,'trade');
});

test('repeated import history shifts a dependent country toward resilience',()=>{
 const before=baseState();before.turn=3;before.foreignStrategies={nord:{mode:'trade',label:'교역 확대',reason:'기존',sinceTurn:1,lastTurn:2,previousMode:null,previousAction:{id:'secure_imports',name:'장기 수입선 확보',turn:2},trend:{food:0,treasury:0},posture:'neutral',postureReason:'',postureUntil:0,observedPolicy:null,lastMetrics:{food:51,treasury:72},importStreak:1}};before.foreignGoals={nord:{lastAction:{id:'secure_imports',name:'장기 수입선 확보',turn:2}}};
 const next=structuredClone(before);prepareForeignStrategies(next,before,{id:'maintain',name:'기존 정책 유지'},[]);
 assert.equal(next.foreignStrategies.nord.mode,'resilience');assert.equal(next.foreignStrategies.nord.previousAction.id,'secure_imports');
});

test('critical food overrides national defaults and completed self-sufficiency stops import-loop escalation',()=>{
 const urgent=baseState();urgent.countries.altia.food=20;urgent.countries.altia.treasury=90;const urgentNext=structuredClone(urgent);prepareForeignStrategies(urgentNext,urgent,{id:'maintain'},[]);assert.equal(urgentNext.foreignStrategies.altia.mode,'food');assert.match(urgentNext.foreignStrategies.altia.reason,/식량 20/);
 const before=baseState();before.turn=7;before.countries.nord.infrastructure=3;before.foreignStrategies={nord:{mode:'resilience',label:'공급 자립',reason:'기존',sinceTurn:3,lastTurn:6,previousMode:'trade',previousAction:null,trend:{food:0,treasury:0},posture:'neutral',postureReason:'',postureUntil:0,observedPolicy:null,lastMetrics:{food:51,treasury:72},importStreak:4}};before.foreignGoals={nord:{lastAction:{id:'secure_imports',name:'장기 수입선 확보',turn:6}}};const next=structuredClone(before);prepareForeignStrategies(next,before,{id:'maintain'},[]);assert.equal(next.foreignStrategies.nord.importStreak,4);assert.equal(next.foreignStrategies.nord.mode,'trade');
});

test('relevant embargo containment lasts three quarters, expires, and affects canonical market scoring',()=>{
 const before=baseState(),contained=structuredClone(before);prepareForeignStrategies(contained,before,{id:'embargo',name:'식량 수출 제한'},[]);
 assert.equal(contained.foreignStrategies.nord.posture,'contain');assert.equal(contained.foreignStrategies.nord.postureUntil,3);
 const scored=marketContext(contained,'nord','buy',2);assert.equal(scored.strategyScoreDelta,-10);assert.ok(scored.reasons.some(reason=>reason.includes('대응')));assert.equal(scored.strategyRemaining,2);
 let prior=contained;for(const turn of [2,3]){const next=structuredClone(prior);next.turn=turn;prepareForeignStrategies(next,prior,{id:'maintain',name:'기존 정책 유지'},[]);assert.equal(next.foreignStrategies.nord.posture,'contain');prior=next;}
 const expired=structuredClone(prior);expired.turn=4;const actions=[];prepareForeignStrategies(expired,prior,{id:'maintain',name:'기존 정책 유지'},actions);assert.equal(expired.foreignStrategies.nord.posture,'neutral');assert.equal(marketContext(expired,'nord','buy',4).strategyScoreDelta,0);const expiry=actions.find(item=>item.actorId==='nord'&&item.posture==='neutral');assert.equal(expiry.previousPosture,'contain');assert.equal(expiry.postureExpired,true);
});

test('aid cooperation is partner-specific and changes the same preview context by six points',()=>{
 const before=baseState(),next=structuredClone(before);prepareForeignStrategies(next,before,{id:'aid',name:'노르드 식량 지원'},[]);
 assert.equal(next.foreignStrategies.nord.posture,'cooperate');assert.equal(next.foreignStrategies.cera.posture,'neutral');
 assert.equal(marketContext(next,'nord','alliance',2).strategyScoreDelta,6);assert.equal(marketContext(next,'cera','alliance',2).strategyScoreDelta,0);
});

test('spot and treaty previews consume the same exact cooperation score',()=>{
 const neutral=baseState();neutral.relations['lumen:nord']=50;const cooperative=structuredClone(neutral);prepareForeignStrategies(cooperative,neutral,{id:'aid',name:'노르드 식량 지원'},[]);
 const spot={targetId:'nord',kind:'buy',food:3,money:6},treaty={targetId:'nord',kind:'alliance',food:3,money:1,duration:4};
 assert.equal(previewProposal(cooperative,spot).score-previewProposal(neutral,spot).score,6);assert.equal(previewTreaty(cooperative,treaty).score-previewTreaty(neutral,treaty).score,6);
});

test('inactive forged strategy state cannot alter canonical market scoring',()=>{
 const state=baseState();state.foreignStrategyStartTurn=5;state.foreignStrategies={nord:{posture:'contain',postureUntil:9}};
 assert.equal(marketContext(state,'nord','buy',2).strategyScoreDelta,0);
});

test('rejected treaty attempts do not create cooperation',()=>{
 const before=baseState(),next=structuredClone(before);prepareForeignStrategies(next,before,{id:'treaty:nord',treatyDraft:{targetId:'nord'},treatyPreview:{response:'reject'}},[]);
 assert.equal(next.foreignStrategies.nord.posture,'neutral');assert.equal(marketContext(next,'nord','alliance',2).strategyScoreDelta,0);
});

test('rejected joint investment cannot create or refresh cooperation while an accepted investment can',()=>{
 const rejectedState=createGame('lumen'),rejected=getAction(rejectedState,'join:nord:port:12:75:4');assert.equal(rejected.jointPreview.outcome,'rejected');
 const rejectedNext=structuredClone(rejectedState);rejectedNext.turn=1;prepareForeignStrategies(rejectedNext,rejectedState,rejected,[]);assert.equal(rejectedNext.foreignStrategies.nord.posture,'neutral');
 const retained=structuredClone(rejectedNext);retained.turn=2;retained.foreignStrategies.nord={...retained.foreignStrategies.nord,posture:'cooperate',postureUntil:2,postureReason:'기존 협력'};const afterRejected=structuredClone(retained);afterRejected.turn=3;prepareForeignStrategies(afterRejected,retained,rejected,[]);assert.equal(afterRejected.foreignStrategies.nord.posture,'neutral');assert.equal(marketContext(afterRejected,'nord','alliance',3).strategyScoreDelta,0);
 const acceptedDraft=['farm','port'].flatMap(kind=>[25,50,75].map(share=>({targetId:'nord',kind,capital:20,share,duration:4}))).find(draft=>previewJointInvestment(rejectedState,draft).outcome==='accepted'),accepted=getAction(rejectedState,jointCommand(acceptedDraft));assert.equal(accepted.jointPreview.outcome,'accepted');
 const acceptedNext=structuredClone(rejectedState);acceptedNext.turn=1;prepareForeignStrategies(acceptedNext,rejectedState,accepted,[]);assert.equal(acceptedNext.foreignStrategies.nord.posture,'cooperate');assert.equal(marketContext(acceptedNext,'nord','alliance',2).strategyScoreDelta,6);
});

test('canonical engine paths produce different inspectable foreign reactions',()=>{
 const embargo=advanceTurn(createGame('lumen'),'embargo'),balanced=advanceTurn(createGame('lumen'),'balanced');
 assert.equal(embargo.foreignStrategies.nord.posture,'contain');assert.equal(balanced.foreignStrategies.nord.posture,'cooperate');
 assert.notEqual(marketContext(embargo,'nord','buy',2).scoreDelta,marketContext(balanced,'nord','buy',2).scoreDelta);
 assert.ok(embargo.history.at(-1).worldActions.some(item=>item.source==='foreign_strategy'&&item.actorId==='nord'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,getAction,peaceComplianceCommand,peaceCompliancePreview} from '../dist/engine.mjs';
import {mediationCommand} from '../dist/mediation.mjs';
import {conflictMarketContext,tradeBlocked} from '../dist/goal-conflicts.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {loadGame,saveGame} from '../dist/storage.mjs';

const dispute=(overrides={})=>({id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:1,startTurn:2,endTurn:9,duration:7,playerStance:null,stanceTurn:null,events:[],reason:'수출 목표 충돌',...overrides});
// These V18 peace sequences isolate compliance timing; V29 strategy/replay is covered by its native suite.
const acceptedPeace=()=>{
 const state=createGame('nord',{peaceComplianceStartTurn:1,foreignSiteStartTurn:999,foreignStrategyStartTurn:999});
 state.turn=2;state.goalConflicts=[dispute()];state.conflictCooldownUntil=12;
 state.relations['cera:nord']=84;state.relations['lumen:nord']=84;
 return advanceTurn(state,mediationCommand({conflictId:state.goalConflicts[0].id,goal:'peace',condition:'mutual',food:8,money:12}));
};
const forcePressure=state=>{
 const next=structuredClone(state);next.countries.cera.food=8;next.countries.cera.price=190;next.reliability.cera=5;next.relations['cera:lumen']=8;next.relations['cera:nord']=10;return next;
};

test('accepted peace registers one monitored accord without checking the signature quarter',()=>{
 const next=acceptedPeace(),accord=next.peaceAccords[0];
 assert.equal(next.version,13);assert.equal(next.peaceComplianceStartTurn,1);
 assert.equal(accord.status,'monitoring');assert.equal(accord.createdTurn,next.turn);assert.equal(accord.startTurn,next.turn+1);assert.equal(accord.endTurn,next.turn+5);
 assert.deepEqual(accord.principalIds,['cera','lumen']);assert.deepEqual(accord.checks,[]);assert.equal(accord.mediationId,next.mediations.at(-1).id);
 assert.equal(next.lastPeaceComplianceEvents[0].type,'accord_registered');
});

test('live pressure, relations, reliability and goals deterministically produce an actual breach',()=>{
 const signed=forcePressure(acceptedPeace()),next=advanceTurn(signed,'maintain'),accord=next.peaceAccords[0];
 assert.equal(accord.status,'violated');assert.equal(accord.violation.countryId,'cera');assert.equal(accord.checks[0].status,'breached');
 assert.match(accord.violation.reason,/식량|물가|관계|신뢰|목표/);assert.equal(accord.violation.untilTurn,next.turn+3);
 assert.ok(next.reliability.cera<signed.reliability.cera);assert.ok(next.relations['cera:lumen']<signed.relations['cera:lumen']);
 const event=next.lastPeaceComplianceEvents.find(item=>item.type==='accord_breached');assert.equal(event.relationChanges[0].delta,-6);assert.equal(event.relationChanges[0].after-event.relationChanges[0].before,-6);
 assert.equal(accord.violation.startsTurn,next.turn+1);assert.equal(tradeBlocked(next,'cera','lumen'),false);assert.equal(tradeBlocked({...next,turn:next.turn+1},'cera','nord'),true);
 assert.equal(conflictMarketContext(next,'cera','lumen','aid_out').scoreDelta,0);
});

test('honor improves real relations and reliability before completing after four future checks',()=>{
 let state=acceptedPeace(),beforeReliability=state.reliability.cera,beforeRelation=state.relations['cera:lumen'];
 for(let index=0;index<4;index++)state=advanceTurn(state,'maintain');
 const accord=state.peaceAccords[0];assert.equal(accord.status,'completed');assert.equal(accord.checks.length,4);
 assert.ok(accord.checks.every(check=>check.status==='fulfilled'));assert.ok(state.reliability.cera>beforeReliability);assert.ok(state.relations['cera:lumen']>beforeRelation);
 assert.ok(state.lastPeaceComplianceEvents.some(event=>event.type==='accord_completed'));
});

test('explicit re-sanction blocks three executions including the command and cannot repeat while active',()=>{
 const breached=advanceTurn(forcePressure(acceptedPeace()),'maintain'),accord=breached.peaceAccords[0],command=peaceComplianceCommand(accord.id,'sanction'),preview=peaceCompliancePreview(breached,accord.id);
 assert.equal(preview.quarters,3);assert.equal(preview.startsTurn,breached.turn+1);assert.equal(preview.untilTurn,breached.turn+4);assert.deepEqual(preview.costs,{food:0,money:0});
 let automatic=advanceTurn(structuredClone(breached),'maintain');automatic=advanceTurn(automatic,'maintain');automatic=advanceTurn(automatic,'maintain');assert.equal(tradeBlocked(automatic,automatic.playerId,'cera'),false);
 let state=advanceTurn(breached,command);assert.equal(state.peaceAccords[0].status,'sanctioned');assert.equal(state.peaceAccords[0].response.untilTurn,state.turn+3);assert.equal(getAction(state,command),null);assert.equal(tradeBlocked(state,state.playerId,'cera'),true);
 state=advanceTurn(state,'maintain');assert.equal(tradeBlocked(state,state.playerId,'cera'),true);
 state=advanceTurn(state,'maintain');assert.equal(tradeBlocked(state,state.playerId,'cera'),true);
 state=advanceTurn(state,'maintain');assert.equal(tradeBlocked(state,state.playerId,'cera'),false);assert.equal(state.peaceAccords[0].status,'completed');assert.ok(state.lastPeaceComplianceEvents.some(event=>event.type==='accord_restriction_expired'));
});

test('accepted renegotiation charges evaluator-capped aid once and replaces the violated accord',()=>{
 const breached=advanceTurn(forcePressure(acceptedPeace()),'maintain'),accord=breached.peaceAccords[0];
 breached.relations['cera:nord']=90;breached.relations['lumen:nord']=90;
 const draft={goal:'peace',condition:'mutual',food:8,money:12},preview=peaceCompliancePreview(breached,accord.id,'renegotiate',draft),command=peaceComplianceCommand(accord.id,'renegotiate',draft),action=getAction(breached,command);
 assert.equal(preview.mediation.outcome,'accepted');assert.deepEqual(action.mediationPreview,preview.mediation);
 const baseline=advanceTurn(structuredClone(breached),'maintain'),next=advanceTurn(breached,command),old=next.peaceAccords.find(item=>item.id===accord.id),revised=next.peaceAccords.find(item=>item.revisionOf===accord.id);
 assert.equal(old.status,'replaced');assert.equal(old.replacedById,revised.id);assert.equal(revised.status,'monitoring');assert.equal(old.violation.untilTurn,next.turn);
 assert.equal(next.countries.nord.food,baseline.countries.nord.food-action.foodCost);assert.equal(next.countries.nord.treasury,baseline.countries.nord.treasury-action.cost);
 assert.equal(tradeBlocked(next,'cera','nord'),false);
});

test('accepted natural relief renegotiation pauses only its source conflict before commerce executes',()=>{
 let state=createGame('nord',{foreignSiteStartTurn:999,foreignStrategyStartTurn:999});for(let turn=0;turn<21;turn++)state=advanceTurn(state,'maintain');
 const conflict=state.goalConflicts.find(item=>item.id==='goal-conflict-cera-lumen-21');state=advanceTurn(state,`stance:${conflict.id}:sanction`);
 state=advanceTurn(state,mediationCommand({conflictId:conflict.id,goal:'relief',condition:'mutual',food:8,money:12}));state=advanceTurn(state,'maintain');
 const old=state.peaceAccords.find(item=>item.status==='violated'),command=peaceComplianceCommand(old.id,'renegotiate',{goal:'relief',condition:'mutual',food:4,money:6}),action=getAction(state,command);assert.equal(action.mediationPreview.outcome,'accepted');
 state.foreignTreaties.push({id:'foreign-cera-lumen-compliance-relief',playerId:'cera',targetId:'lumen',kind:'trade_sell',food:2,money:4,duration:4,status:'active',startTurn:state.turn+1,endTurn:state.turn+5,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[]});
 state.treaties.push({id:'own-lumen-compliance-relief',playerId:'nord',targetId:'lumen',kind:'trade_buy',food:2,money:4,duration:4,status:'active',startTurn:state.turn+1,endTurn:state.turn+5,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[]});
 const unrelated=dispute({id:'goal-conflict-altia-marin-24',initiatorId:'altia',targetId:'marin',sanctionMembers:['altia'],responseMembers:['marin'],formedTurn:24,startTurn:25,endTurn:30,duration:5});state.goalConflicts.push(unrelated);
 state=advanceTurn(state,command);const commerce=state.history.at(-1).worldActions,source=state.goalConflicts.find(item=>item.id===conflict.id),other=state.goalConflicts.find(item=>item.id===unrelated.id);
 assert.equal(commerce.find(item=>item.countryId==='cera'&&item.targetId==='lumen'&&item.source==='foreign_treaty').type,'trade');assert.equal(commerce.find(item=>item.countryId==='lumen'&&item.targetId==='nord'&&item.source==='treaty').type,'trade');
 assert.equal(source.status,'active');assert.equal(source.ceasefireStartTurn,state.turn);assert.equal(source.ceasefireUntil,source.endTurn);assert.equal(other.status,'active');assert.equal(other.ceasefireUntil,undefined);assert.equal(state.peaceAccords.find(item=>item.id===old.id).status,'replaced');
});

test('commands reject forged ids, invalid drafts and values beyond the canonical bound',()=>{
 assert.equal(peaceComplianceCommand('../accord','sanction'),null);assert.equal(peaceComplianceCommand('peace-accord-x-1','delete'),null);
 assert.equal(peaceComplianceCommand('peace-accord-x-1','renegotiate',{goal:'peace',condition:'mutual',food:7,money:12}),null);
 assert.equal(peaceComplianceCommand(`peace-accord-${'x'.repeat(150)}-1`,'sanction'),null);
});

test('preview is immutable and an escalated renegotiation cannot extend unrelated conflict cooldown',()=>{
 const state=advanceTurn(forcePressure(acceptedPeace()),'maintain'),accord=state.peaceAccords[0],draft={goal:'peace',condition:'target',food:0,money:0},before=structuredClone(state),preview=peaceCompliancePreview(state,accord.id,'renegotiate',draft);
 assert.deepEqual(state,before);assert.equal(preview.mediation.outcome,'escalated');const cooldown=state.conflictCooldownUntil,next=advanceTurn(state,peaceComplianceCommand(accord.id,'renegotiate',draft));
 assert.equal(next.conflictCooldownUntil,cooldown);assert.equal(next.goalConflicts.find(item=>item.peaceComplianceAccordId===accord.id).status,'resolved');assert.equal(next.peaceAccords[0].status,'violated');
});

test('ordinary maintain play reaches a pressure-and-goal-driven breach without state mutation',()=>{
 let state=createGame('nord',{foreignSiteStartTurn:999,foreignStrategyStartTurn:999});for(let turn=0;turn<21;turn++)state=advanceTurn(state,'maintain');
 const conflict=state.goalConflicts.find(item=>item.id==='goal-conflict-cera-lumen-21'),command=mediationCommand({conflictId:conflict.id,goal:'relief',condition:'mutual',food:0,money:0});
 state=advanceTurn(state,command);assert.equal(state.peaceAccords.at(-1).status,'monitoring');
 state=advanceTurn(state,'maintain');const accord=state.peaceAccords.at(-1);
 assert.equal(accord.status,'violated');assert.equal(accord.violation.countryId,'cera');assert.match(accord.violation.reason,/식량 40의 압박/);assert.match(accord.violation.reason,/경쟁하는 국가 목표/);
});

test('ordinary maintain play can breach a full peace while a healthy earlier peace remains kept',()=>{
 let healthy=createGame('nord',{foreignSiteStartTurn:999,foreignStrategyStartTurn:999});for(let turn=0;turn<3;turn++)healthy=advanceTurn(healthy,'maintain');
 const early=healthy.goalConflicts.find(item=>item.id==='goal-conflict-cera-lumen-3');healthy=advanceTurn(healthy,mediationCommand({conflictId:early.id,goal:'peace',condition:'mutual',food:8,money:12}));healthy=advanceTurn(healthy,'maintain');assert.equal(healthy.peaceAccords.at(-1).checks[0].status,'fulfilled');
 let pressured=createGame('nord',{foreignSiteStartTurn:999,foreignStrategyStartTurn:999});for(let turn=0;turn<24;turn++)pressured=advanceTurn(pressured,'maintain');
 const late=pressured.goalConflicts.find(item=>item.id==='goal-conflict-cera-lumen-21');pressured=advanceTurn(pressured,mediationCommand({conflictId:late.id,goal:'peace',condition:'mutual',food:8,money:6}));
 pressured=advanceTurn(pressured,'maintain');pressured=advanceTurn(pressured,'maintain');const accord=pressured.peaceAccords.at(-1);
 assert.equal(accord.sourceGoal,'peace');assert.equal(accord.status,'violated');assert.equal(accord.checks.at(-1).results[0].score,62);assert.match(accord.violation.reason,/식량|물가|관계|신뢰|목표/);
});

test('a real renegotiation counter can be accepted later and reconciles the replacement lifecycle',()=>{
 let state=createGame('nord',{foreignSiteStartTurn:999,foreignStrategyStartTurn:999});for(let turn=0;turn<21;turn++)state=advanceTurn(state,'maintain');
 const conflict=state.goalConflicts.find(item=>item.id==='goal-conflict-cera-lumen-21');state=advanceTurn(state,mediationCommand({conflictId:conflict.id,goal:'relief',condition:'mutual',food:0,money:0}));state=advanceTurn(state,'maintain');
 const old=state.peaceAccords.at(-1),draft={goal:'peace',condition:'mutual',food:0,money:0},command=peaceComplianceCommand(old.id,'renegotiate',draft);state=advanceTurn(state,command);
 const counter=state.mediations.find(item=>item.id===state.peaceAccords.find(item=>item.id===old.id).response.mediationId);assert.equal(counter.status,'countered');assert.equal(state.peaceAccords.find(item=>item.id===old.id).status,'renegotiating');
 const followup=getAction(state,`mediate-accept:${counter.id}`);assert.equal(followup.mediationPreview.outcome,'accepted');state=advanceTurn(state,followup.id);
 const original=state.peaceAccords.find(item=>item.id===old.id),revised=state.peaceAccords.find(item=>item.revisionOf===old.id);assert.equal(original.status,'replaced');assert.equal(revised.status,'monitoring');assert.equal(original.replacedById,revised.id);
 assert.equal(state.history.at(-1).worldActions.some(item=>item.type==='sanction'&&[item.countryId,item.targetId].includes(original.violation.countryId)),false);
});

test('accepted natural counter lifts the old block before its follow-up commerce executes',()=>{
 let state=createGame('nord',{foreignSiteStartTurn:999,foreignStrategyStartTurn:999});for(let turn=0;turn<21;turn++)state=advanceTurn(state,'maintain');
 const conflict=state.goalConflicts.find(item=>item.id==='goal-conflict-cera-lumen-21');state=advanceTurn(state,mediationCommand({conflictId:conflict.id,goal:'relief',condition:'mutual',food:0,money:0}));state=advanceTurn(state,'maintain');
 const old=state.peaceAccords.find(item=>item.status==='violated');state=advanceTurn(state,peaceComplianceCommand(old.id,'renegotiate',{goal:'peace',condition:'mutual',food:0,money:0}));
 const counter=state.mediations.find(item=>item.id===state.peaceAccords.find(item=>item.id===old.id).response.mediationId),followup=getAction(state,`mediate-accept:${counter.id}`);assert.equal(followup.mediationPreview.outcome,'accepted');
 state.foreignTreaties.push({id:'foreign-cera-lumen-compliance-trade',playerId:'cera',targetId:'lumen',kind:'trade_sell',food:2,money:4,duration:4,status:'active',startTurn:state.turn+1,endTurn:state.turn+5,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[]});
 state.treaties.push({id:'own-cera-compliance-trade',playerId:'nord',targetId:'cera',kind:'trade_buy',food:2,money:4,duration:4,status:'active',startTurn:state.turn+1,endTurn:state.turn+5,fulfilled:0,breaches:0,streak:0,lastOutcome:null,events:[]});
 const unrelated=dispute({id:'goal-conflict-altia-marin-24',initiatorId:'altia',targetId:'marin',sanctionMembers:['altia'],responseMembers:['marin'],formedTurn:24,startTurn:25,endTurn:30,duration:5});state.goalConflicts.push(unrelated);
 state=advanceTurn(state,followup.id);const commerce=state.history.at(-1).worldActions,source=state.goalConflicts.find(item=>item.id===conflict.id),other=state.goalConflicts.find(item=>item.id===unrelated.id);
 assert.equal(commerce.find(item=>item.countryId==='cera'&&item.targetId==='lumen'&&item.source==='foreign_treaty').type,'trade');assert.equal(commerce.find(item=>item.countryId==='cera'&&item.targetId==='nord'&&item.source==='treaty').type,'trade');assert.equal(source.status,'resolved');assert.equal(source.resolvedBy,'peace_compliance');assert.equal(other.status,'active');assert.equal(state.peaceAccords.find(item=>item.id===old.id).status,'replaced');
});

test('storage activation defaults old slots to the replay boundary and preserves explicit markers',()=>{
 const memory=new Map();globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
 const state=createGame('solis',{peaceComplianceStartTurn:1});saveGame(state,{phase:'decision',step:0});
 const root=JSON.parse(memory.get('one-planet-food-crisis-v4'));assert.equal(root.games.solis.peaceComplianceStartTurn,1);assert.equal(loadGame('solis').state.peaceComplianceStartTurn,1);
 root.games.solis.actions=['maintain','maintain'];delete root.games.solis.peaceComplianceStartTurn;root.games.solis.phase='decision';memory.set('one-planet-food-crisis-v4',JSON.stringify(root));
 const restored=loadGame('solis');assert.equal(restored.state.peaceComplianceStartTurn,3);assert.deepEqual(restored.state.peaceAccords,[]);
});

test('lean chronicle replay uses the activation marker and does not depend on bounded history length',()=>{
 let state=createGame('nord',{peaceComplianceStartTurn:4});for(let turn=0;turn<24;turn++)state=advanceTurn(state,'maintain');
 const full=buildChronicle(state),lean=structuredClone(state);lean.history=[];const replayed=buildChronicle(lean);
 assert.equal(replayed.points.length,state.commands.length+1);assert.deepEqual(replayed.points,full.points);
});

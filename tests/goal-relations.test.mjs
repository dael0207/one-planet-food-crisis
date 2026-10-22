import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCountries} from '../dist/country-data.mjs';
import {initialRelations} from '../dist/negotiations.mjs';
import {OBJECTIVE_PLANS} from '../dist/objectives-data.mjs';
import {goalMarketContext,goalPairAffinity,goalRelations,goalRequest,runGoalRelations} from '../dist/goal-relations.mjs';

const state=(playerId='lumen',overrides={})=>({
 playerId,turn:3,worldGoalStartTurn:1,activePolicy:'open',countries:initialCountries(),relations:initialRelations(),foreignTreaties:[],lastForeignEvents:[],lastGoalEvents:[],...overrides,
});
const totalTreasury=value=>Object.values(value.countries).reduce((sum,country)=>sum+country.treasury,0);

test('goal relationships are deterministic, world-wide and activation-gated',()=>{
 // Given
 const active=state('lumen'),legacy=state('lumen');delete legacy.worldGoalStartTurn;
 // When
 const first=goalRelations(active),replay=goalRelations(active);
 // Then
 assert.deepEqual(first,replay);assert.ok(first.length<=8);assert.ok(first.length>0);
 assert.ok(first.some(item=>item.countryId===active.playerId||item.targetId===active.playerId));
 assert.ok(first.some(item=>![item.countryId,item.targetId].includes(active.playerId)));
 assert.equal(new Set(first.map(item=>[item.countryId,item.targetId].sort().join(':'))).size,first.length);
 assert.ok(first.every(item=>item.countryId!==item.targetId));assert.deepEqual(goalRelations(legacy),[]);
 assert.deepEqual(goalRelations(state('lumen',{turn:3,worldGoalStartTurn:4})),[]);
});

test('export rivals compete only while both hold viable food stocks',()=>{
 // Given
 const viable=state('lumen');viable.countries.lumen.food=55;viable.countries.cera.food=54;
 const depleted=structuredClone(viable);depleted.countries.cera.food=39;
 // When
 const rivalry=goalRelations(viable).find(item=>item.type==='competition');
 const absent=goalRelations(depleted).find(item=>item.type==='competition');
 // Then
 assert.ok(rivalry);assert.equal(rivalry.countryId,'lumen');assert.equal(rivalry.targetId,'cera');assert.equal(absent,undefined);
 assert.equal(rivalry.title,`${OBJECTIVE_PLANS.lumen.title} ↔ ${OBJECTIVE_PLANS.cera.title}`);
});

test('goal affinity rewards coherent partners and penalizes hostile exporter rivals',()=>{
 // Given
 const value=state('altia');value.relations['altia:solis']=60;
 const hostile=state('lumen');hostile.relations['cera:lumen']=28;
 // When
 const cooperation=goalPairAffinity(value,'altia','solis','alliance');
 const competition=goalPairAffinity(hostile,'lumen','cera','trade_sell');
 // Then
 assert.ok(cooperation.scoreDelta>0);assert.ok(competition.scoreDelta<0);
 assert.ok(cooperation.reason.length>0);assert.ok(competition.reason.length>0);
});

test('goal market context changes reactions within bounds without rewarding an infeasible seller',()=>{
 // Given
 const viable=state('lumen');viable.countries.lumen.food=70;viable.countries.nord.food=42;
 const depleted=structuredClone(viable);depleted.countries.lumen.food=24;
 // When
 const coherent=goalMarketContext(viable,'nord','sell');
 const impossible=goalMarketContext(depleted,'nord','sell');
 const repeated=goalMarketContext(viable,'nord','sell');
 // Then
 assert.deepEqual(coherent,repeated);assert.ok(coherent.scoreDelta>0);assert.ok(coherent.scoreDelta<=12);
 assert.ok(coherent.reasons.length>0);assert.ok(impossible.scoreDelta<=0);
});

test('competition retains one unit in the actual buyer budget and conserves treasury',()=>{
 // Given
 const next=state('lumen',{turn:4});next.countries.lumen.treasury=60;next.countries.nord.treasury=40;
 const before=structuredClone(next),parts=[],actions=[
  {countryId:'lumen',targetId:'nord',type:'trade',source:'policy',text:'player shipment'},
  {countryId:'cera',targetId:'nord',type:'trade',source:'autonomous',text:'rival shipment'},
 ];
 const treasury=totalTreasury(next);
 // When
 runGoalRelations(next,before,parts,actions);
 // Then
 assert.equal(next.countries.lumen.treasury,59);assert.equal(next.countries.nord.treasury,41);
 assert.equal(totalTreasury(next),treasury);assert.equal(next.lastGoalEvents.length,1);
 assert.equal(next.lastGoalEvents[0].playerImpact.treasury,-1);
 assert.ok(actions.some(item=>item.source==='national_goal'&&item.type==='competition'));
});

test('competition never invents a market and respects an export embargo',()=>{
 // Given
 const idle=state('lumen',{turn:4}),embargo=state('lumen',{turn:4,activePolicy:'embargo'});
 const overlap=[{countryId:'lumen',targetId:'nord',type:'trade',source:'policy',text:'player shipment'},{countryId:'cera',targetId:'nord',type:'trade',source:'autonomous',text:'rival shipment'}];
 const idleBefore=structuredClone(idle),embargoBefore=structuredClone(embargo);
 // When
 runGoalRelations(idle,idleBefore,[],[]);runGoalRelations(embargo,embargoBefore,[],structuredClone(overlap));
 // Then
 assert.deepEqual(idle.lastGoalEvents,[]);assert.deepEqual(embargo.lastGoalEvents,[]);
 assert.equal(embargo.countries.lumen.treasury,embargoBefore.countries.lumen.treasury);
});

test('foreign competition discounts only a paid real shipment and conserves buyer cash',()=>{
 // Given
 const next=state('altia',{turn:4});next.countries.cera.treasury=55;next.countries.nord.treasury=32;
 const before=structuredClone(next),actions=[
  {countryId:'cera',targetId:'nord',type:'trade',source:'foreign_treaty',food:4,money:8,text:'paid shipment'},
  {countryId:'lumen',targetId:'nord',type:'trade',source:'structural',text:'competing shipment'},
 ];
 const treasury=totalTreasury(next);
 // When
 runGoalRelations(next,before,[],actions);
 // Then
 assert.equal(next.countries.cera.treasury,54);assert.equal(next.countries.nord.treasury,33);
 assert.equal(totalTreasury(next),treasury);assert.equal(next.lastGoalEvents[0].playerImpact.treasury,0);
 assert.equal(next.lastGoalEvents[0].marketImpact.discount,1);
});

test('competition reports the governed buyer cash benefit and ignores paid trades to another buyer',()=>{
 // Given
 const next=state('nord',{turn:4});next.countries.cera.treasury=55;next.countries.nord.treasury=32;
 const before=structuredClone(next),actions=[
  {countryId:'cera',targetId:'nord',type:'trade',source:'structural',text:'overlap'},
  {countryId:'lumen',targetId:'nord',type:'trade',source:'structural',text:'overlap'},
  {countryId:'cera',targetId:'solis',type:'trade',source:'foreign_treaty',food:4,money:8,text:'other paid shipment'},
  {countryId:'lumen',targetId:'nord',type:'trade',source:'foreign_treaty',food:3,money:6,text:'chosen paid shipment'},
 ];
 // When
 runGoalRelations(next,before,[],actions);
 // Then
 assert.equal(next.countries.nord.treasury,33);assert.equal(next.lastGoalEvents[0].playerImpact.treasury,1);
 assert.equal(next.lastGoalEvents[0].marketImpact.buyerId,'nord');assert.equal(next.lastGoalEvents[0].marketImpact.sellerId,'lumen');
});

test('competition names the other exporter and records the clamped relation change',()=>{
 // Given
 const next=state('cera',{turn:4});next.relations['cera:lumen']=1;
 const before=structuredClone(next),actions=[
  {countryId:'cera',targetId:'nord',type:'trade',source:'policy',text:'player shipment'},
  {countryId:'lumen',targetId:'nord',type:'trade',source:'structural',text:'rival shipment'},
 ];
 // When
 runGoalRelations(next,before,[],actions);
 // Then
 assert.equal(next.relations['cera:lumen'],0);assert.equal(next.lastGoalEvents[0].playerImpact.relationDelta,-1);
 assert.ok(next.lastGoalEvents[0].playerImpact.text.includes('루멘'));assert.equal('scoreDelta' in next.lastGoalEvents[0].playerImpact,false);
});

test('a real newly formed coherent pact records cooperation without an unrelated player score',()=>{
 // Given
 const next=state('altia',{foreignTreaties:[{id:'formed-1',playerId:'nord',targetId:'marin',kind:'alliance',status:'active'}],lastForeignEvents:[{turn:3,type:'formed',countryId:'nord',targetId:'marin',treatyId:'formed-1'}]});
 const before=structuredClone(next),food=Object.values(next.countries).map(country=>country.food),treasury=totalTreasury(next);
 // When
 runGoalRelations(next,before,[],[]);
 // Then
 assert.equal(next.lastGoalEvents.length,1);assert.equal(next.lastGoalEvents[0].type,'cooperation');assert.equal(next.lastGoalEvents[0].playerImpact.scoreDelta,undefined);
 assert.deepEqual(Object.values(next.countries).map(country=>country.food),food);assert.equal(totalTreasury(next),treasury);
});

test('goal requests are useful, affordable and disabled for legacy campaigns',()=>{
 // Given
 const tech=state('lumen');tech.countries.lumen.treasury=20;
 const supplier=state('nord');supplier.countries.cera.food=70;supplier.countries.nord.food=45;
 const drought=state('lumen');drought.countries.solis.food=30;drought.countries.lumen.food=65;
 const legacy=state('lumen');delete legacy.worldGoalStartTurn;
 // When
 const technology=goalRequest(tech,'altia'),trade=goalRequest(supplier,'cera'),aid=goalRequest(drought,'solis');
 // Then
 assert.equal(technology.type,'technology');assert.deepEqual(technology.terms,{food:3,treasury:12,duration:4});
 assert.equal(trade.type,'trade');assert.deepEqual(trade.terms,{food:3,treasury:12,duration:4});
 assert.equal(aid.type,'aid');assert.ok(aid.terms.food>0);assert.equal(goalRequest(legacy,'altia'),null);
 assert.equal(technology.goalTitle,OBJECTIVE_PLANS.altia.title);
});

test('goal requests decline when the proposal cannot be used or supported',()=>{
 // Given
 const full=state('lumen');full.countries.lumen.food=99;
 const poorBuyer=state('nord');poorBuyer.countries.nord.treasury=1;poorBuyer.countries.cera.food=70;
 const poorDonor=state('lumen');poorDonor.countries.lumen.food=22;poorDonor.countries.solis.food=25;
 // When
 const tech=goalRequest(full,'altia'),trade=goalRequest(poorBuyer,'cera'),aid=goalRequest(poorDonor,'solis');
 // Then
 assert.equal(tech,null);assert.equal(trade,null);assert.equal(aid,null);
});

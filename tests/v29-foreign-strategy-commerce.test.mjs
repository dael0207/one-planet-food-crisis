import test from 'node:test';
import assert from 'node:assert/strict';

import {COUNTRY_IDS} from '../dist/country-data.mjs';
import {createGame} from '../dist/engine.mjs';
import {createForeignSites} from '../dist/foreign-sites.mjs';
import {runForeignSiteDecisions} from '../dist/foreign-sites-commerce.mjs';

const total=(state,key)=>COUNTRY_IDS.reduce((sum,id)=>sum+state.countries[id][key],0);

function marketState(posture){
 const state=createGame('lumen');state.turn=2;state.foreignSites=createForeignSites('lumen');state.foreignStrategies={};
 for(const id of COUNTRY_IDS.filter(id=>id!=='lumen')){
  for(const site of Object.values(state.foreignSites[id]))site.level=3;
  state.foreignSites[id].port.level=id==='cera'?2:0;if(id==='cera')state.foreignSites[id].port.project={level:3,startTurn:2,dueTurn:4};
  state.foreignStrategies[id]={mode:'trade',posture:id==='cera'?posture:'neutral',postureUntil:4};state.countries[id].food=20;state.countries[id].treasury=20;
 }
 state.countries.cera.food=80;state.countries.lumen.food=60;state.countries.lumen.treasury=20;return state;
}

test('containment withholds only an actually available open-market shipment without fabricating loss',()=>{
 const state=marketState('contain'),food=total(state,'food'),money=total(state,'treasury'),before=structuredClone(state.countries),actions=[],parts=[];
 runForeignSiteDecisions(state,parts,actions);
 const withheld=actions.find(item=>item.operation==='withheld');assert.ok(withheld);assert.equal(withheld.withheldFood,4);assert.deepEqual(withheld.playerImpact,{food:0,treasury:0,text:'실제 이전 없음'});
 assert.deepEqual(state.countries,before);assert.equal(total(state,'food'),food);assert.equal(total(state,'treasury'),money);assert.deepEqual(parts,[]);
});

test('cooperation ships the same real bounded supply and preserves food and money',()=>{
 const state=marketState('cooperate'),food=total(state,'food'),money=total(state,'treasury'),actions=[],parts=[];
 runForeignSiteDecisions(state,parts,actions);
 const shipment=actions.find(item=>item.operation==='trade'&&item.countryId==='cera');assert.equal(shipment.food,4);assert.equal(shipment.money,4);assert.deepEqual(shipment.playerImpact,{food:4,treasury:-4});
 assert.equal(state.countries.lumen.food,64);assert.equal(state.countries.lumen.treasury,16);assert.equal(state.countries.cera.food,76);assert.equal(state.countries.cera.treasury,24);assert.equal(total(state,'food'),food);assert.equal(total(state,'treasury'),money);
});

test('fiscal strategy waits rather than starting optional construction below reserve',()=>{
 const state=marketState('neutral');state.foreignSites.cera.port.level=0;state.foreignSites.cera.port.project=null;state.foreignStrategies.cera.mode='fiscal';state.countries.cera.treasury=60;state.countries.cera.food=70;const actions=[];
 runForeignSiteDecisions(state,[],actions);
 assert.equal(state.foreignSites.cera.city.project,null);assert.equal(state.foreignSites.cera.farm.project,null);assert.equal(state.foreignSites.cera.port.project,null);assert.ok(!actions.some(item=>item.countryId==='cera'&&item.operation==='upgrade'));
});

test('sanctions still block cooperative open-market exports',()=>{
 const state=marketState('cooperate');state.conflictStartTurn=1;state.goalConflicts=[{id:'block',status:'active',initiatorId:'lumen',targetId:'cera',startTurn:1,endTurn:5,sanctionMembers:['lumen'],responseMembers:['cera']}];const before=structuredClone(state.countries),actions=[];
 runForeignSiteDecisions(state,[],actions);
 assert.deepEqual(state.countries,before);assert.ok(!actions.some(item=>item.countryId==='cera'&&['trade','withheld'].includes(item.operation)));
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {COUNTRY_IDS,createGame} from '../dist/engine.mjs';
import {createForeignSites} from '../dist/foreign-sites.mjs';
import {runForeignSiteDecisions} from '../dist/foreign-sites-commerce.mjs';

const total=(state,key)=>COUNTRY_IDS.reduce((sum,id)=>sum+state.countries[id][key],0);

function controlledState(){
 const state=createGame('lumen');state.turn=1;state.foreignSites=createForeignSites('lumen');
 for(const id of COUNTRY_IDS.filter(countryId=>countryId!=='lumen')){
  state.countries[id].food=70;state.countries[id].treasury=20;state.countries[id].price=100;
  for(const site of Object.values(state.foreignSites[id])){site.level=3;site.project=null;site.lastDecision={turn:0,operation:'manage',reason:'fixture'};}
 }
 return state;
}

test('NPC port procurement conserves exact food and cash while honoring seller reserve and treasury cap',()=>{
 const state=controlledState(),buyer=state.countries.cera,seller=state.countries.altia;
 state.foreignSites.cera.farm.level=0;buyer.food=40;buyer.treasury=30;
 for(const id of COUNTRY_IDS.filter(id=>!['lumen','cera','altia'].includes(id)))state.countries[id].food=20;
 seller.food=80;seller.treasury=99;
 const foodBefore=total(state,'food'),moneyBefore=total(state,'treasury'),buyerBefore={food:buyer.food,treasury:buyer.treasury},sellerBefore={food:seller.food,treasury:seller.treasury},actions=[];

 runForeignSiteDecisions(state,[],actions);

 const event=actions.find(item=>item.countryId==='cera'&&item.operation==='manage'&&item.kind==='port');
 assert.deepEqual({food:buyer.food-buyerBefore.food,money:buyer.treasury-buyerBefore.treasury},{food:1,money:-1});
 assert.deepEqual({food:seller.food-sellerBefore.food,money:seller.treasury-sellerBefore.treasury},{food:-1,money:1});
 assert.deepEqual({food:event.food,money:event.money,from:event.shipmentFromId,to:event.shipmentToId},{food:1,money:-1,from:'altia',to:'cera'});
 assert.equal(total(state,'food'),foodBefore);assert.equal(total(state,'treasury'),moneyBefore);
 assert.ok(seller.food>=20);assert.equal(seller.treasury,100);assert.ok(buyer.food<=100);assert.ok(buyer.treasury>=20);
});

test('foreign port sale to the player is limited by actual buyer cash and seller treasury room',()=>{
 const state=controlledState(),buyer=state.countries.lumen,seller=state.countries.cera;
 buyer.food=60;buyer.treasury=1;seller.food=70;seller.treasury=99;
 for(const id of COUNTRY_IDS.filter(id=>!['lumen','cera'].includes(id)))state.countries[id].food=20;
 const foodBefore=total(state,'food'),moneyBefore=total(state,'treasury'),actions=[],parts=[];

 runForeignSiteDecisions(state,parts,actions);

 const event=actions.find(item=>item.countryId==='cera'&&item.targetId==='lumen'&&item.operation==='trade');
 assert.deepEqual({buyerFood:buyer.food,buyerMoney:buyer.treasury,sellerFood:seller.food,sellerMoney:seller.treasury},{buyerFood:61,buyerMoney:0,sellerFood:69,sellerMoney:100});
 assert.deepEqual({food:event.food,money:event.money,playerImpact:event.playerImpact,from:event.shipmentFromId,to:event.shipmentToId},{food:1,money:1,playerImpact:{food:1,treasury:-1},from:'cera',to:'lumen'});
 assert.deepEqual(parts,[{label:'세라 외국 항만 시장 조달',value:1}]);
 assert.equal(total(state,'food'),foodBefore);assert.equal(total(state,'treasury'),moneyBefore);assert.ok(seller.food>=20);assert.ok(buyer.food<=100);
});

test('foreign ports cannot ship to a buyer with no funds or no food capacity',()=>{
 for(const buyer of [{food:60,treasury:0},{food:100,treasury:50}]){
  const state=controlledState();Object.assign(state.countries.lumen,buyer);state.countries.cera.food=80;state.countries.cera.treasury=40;
  for(const id of COUNTRY_IDS.filter(id=>!['lumen','cera'].includes(id)))state.countries[id].food=20;
  const before=structuredClone(state.countries),actions=[],parts=[];

  runForeignSiteDecisions(state,parts,actions);

  assert.equal(actions.some(item=>item.operation==='trade'&&item.targetId==='lumen'),false);
  assert.deepEqual(parts,[]);assert.deepEqual(state.countries,before);
 }
});

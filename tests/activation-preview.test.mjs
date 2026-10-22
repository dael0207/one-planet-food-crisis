import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,getAction,COUNTRY_IDS} from '../dist/engine.mjs';

test('first-quarter spot negotiation keeps the displayed counter instead of silently accepting',()=>{
 const state=createGame(),before=structuredClone(state),action=getAction(state,'propose:nord:buy:2:3');
 assert.equal(action.preview.response,'counter');
 const next=advanceTurn(state,action.id),record=next.negotiations.at(-1);
 assert.equal(record.status,'countered');assert.equal(record.settlement,undefined);assert.deepEqual(record.reasons,action.preview.reasons);assert.deepEqual(state,before);
});

test('first-quarter rejected treaty cannot activate and transfer resources during execution',()=>{
 const state=createGame(),action=getAction(state,'treaty:nord:trade_buy:2:1:4');
 assert.equal(action.treatyPreview.response,'reject');
 const next=advanceTurn(state,action.id);
 assert.equal(next.treaties.at(-1).status,'rejected');assert.ok(!next.lastTreatyEvents.some(event=>event.type==='fulfilled'));assert.deepEqual(next.lastTreatyEvents[0].reasons,action.treatyPreview.reasons);
});

test('fresh, legacy activation and active goal quarters execute the exact validated proposal response',()=>{
 const labels={accept:'accepted',counter:'countered',reject:'rejected'};
 for(const playerId of COUNTRY_IDS)for(const mode of ['fresh','legacy','active']){
  let state=createGame(playerId,{worldGoalStartTurn:mode==='legacy'?2:1});
  if(mode!=='fresh')state=advanceTurn(state,'maintain');
  for(const targetId of COUNTRY_IDS.filter(id=>id!==playerId))for(const kind of ['buy','sell','aid_out','aid_in']){
   const action=getAction(state,'propose:'+targetId+':'+kind+':2:3');if(!action)continue;
   const next=advanceTurn(state,action.id),record=next.negotiations.at(-1);
   assert.equal(record.status,labels[action.preview.response],playerId+'/'+mode+'/'+action.id);assert.deepEqual(record.reasons,action.preview.reasons);
   if(action.preview.response!=='accept')assert.equal(record.settlement,undefined);
  }
  for(const targetId of COUNTRY_IDS.filter(id=>id!==playerId))for(const kind of ['trade_buy','trade_sell','alliance']){
   const action=getAction(state,'treaty:'+targetId+':'+kind+':2:1:4');if(!action)continue;
   const next=advanceTurn(state,action.id),record=next.treaties.at(-1);
   assert.equal(record.status,action.treatyPreview.response==='accept'?'active':'rejected',playerId+'/'+mode+'/'+action.id);assert.deepEqual(next.lastTreatyEvents[0].reasons,action.treatyPreview.reasons);
  }
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,getAction,treatyCommand} from '../dist/engine.mjs';
import {getObjectiveView} from '../dist/objectives.mjs';
import {getDomesticOrders} from '../dist/scenarios.mjs';

const campaigns={
 lumen:{
  stageTurns:[4,7,10],
  commands:['balanced','invest','maintain','maintain','mandate_lumen_1','mandate_lumen_1','invest','maintain','maintain','mandate_lumen_2'],
 },
 nord:{
  stageTurns:[2,4,9],
  commands:['secure_imports','strategic_reserve','mandate_nord_1','mandate_nord_1','treaty:cera:trade_buy:1:3:8','maintain','maintain','mandate_nord_2','maintain'],
 },
 cera:{
  stageTurns:[8,10,14],
  commands:['invest','maintain','maintain','invest','maintain','maintain','export_push','export_push','mandate_cera_1','mandate_cera_1','mandate_cera_2','export_push','export_push','export_push'],
 },
 altia:{
  stageTurns:[5,7,12],
  commands:['research','research','invest','maintain','maintain','mandate_altia_1','mandate_altia_1','license','invest','maintain','maintain','mandate_altia_2'],
 },
 marin:{
  stageTurns:[2,4,8],
  commands:['expand_routes','emergency_import','mandate_marin_1','mandate_marin_1','treaty:cera:trade_buy:1:3:8','maintain','maintain','mandate_marin_2'],
 },
 solis:{
  stageTurns:[4,6,10],
  commands:['resilience','invest','maintain','maintain','mandate_solis_1','mandate_solis_1','invest','maintain','maintain','mandate_solis_2'],
 },
};

const playCampaign=(playerId,commands)=>{
 // Recorded mandate dates isolate the original world; default-world viability is covered separately.
 let state=createGame(playerId,{conflictStartTurn:999,foreignSiteStartTurn:999,foreignStrategyStartTurn:999});
 for(const command of commands){
  const domestic=getDomesticOrders(state).some(order=>order.id===command);
  const action=getAction(state,command);
  if(!domestic){
   assert.ok(action?.treatyDraft,`${playerId} Q${state.turn+1}: ${command} is absent from the domestic catalog and is not a treaty`);
   assert.equal(treatyCommand(action.treatyDraft),command,`${playerId} Q${state.turn+1}: treaty command is not canonical`);
   assert.equal(action.treatyPreview.response,'accept',`${playerId} Q${state.turn+1}: treaty partner rejected the fixed terms`);
  }
  state=advanceTurn(state,command);
 }
 return state;
};

for(const [playerId,campaign] of Object.entries(campaigns)){
 test(`${playerId} reaches all three national mandate stages through playable commands`,()=>{
  // Given a fresh national campaign, when its fixed successful commands are played through real engine boundaries.
  const state=playCampaign(playerId,campaign.commands);

  // Then every stage is attained on its recorded quarter and the endless campaign reports the mandate complete.
  assert.deepEqual(state.objectives.completed.map(item=>item.stage),[1,2,3]);
  assert.deepEqual(state.objectives.completed.map(item=>item.turn),campaign.stageTurns);
  assert.equal(getObjectiveView(state).done,true);
  assert.equal(state.turn,campaign.commands.length);
 });
}

test('completed national mandate remains attained after its live metrics deteriorate',()=>{
 // Given Cera has completed its mandate through the fixed playable campaign.
 const completed=playCampaign('cera',campaigns.cera.commands);

 // When three further valid export orders lower food below the stage-three threshold.
 const deteriorated=playCampaign('cera',[...campaigns.cera.commands,'export_push','export_push','export_push']);

 // Then the attained stages remain permanent and are not emitted again.
 assert.ok(deteriorated.countries.cera.food<55);
 assert.deepEqual(deteriorated.objectives.completed,completed.objectives.completed);
 assert.equal(getObjectiveView(deteriorated).done,true);
});

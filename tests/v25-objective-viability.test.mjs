import test from 'node:test';
import assert from 'node:assert/strict';

import {COUNTRY_IDS,advanceTurn,createGame,getAction} from '../dist/engine.mjs';

const plans={
 lumen:['balanced','invest','maintain','maintain','mandate_lumen_1','mandate_lumen_1','invest','maintain','maintain','mandate_lumen_2'],
 nord:['secure_imports','strategic_reserve','mandate_nord_1','mandate_nord_1','treaty:cera:trade_buy:1:3:8','maintain','maintain','mandate_nord_2','maintain'],
 cera:['invest','maintain','maintain','invest','maintain','maintain','export_push','export_push','mandate_cera_1','mandate_cera_1','mandate_cera_2','export_push','export_push','export_push','export_push'],
 altia:['research','research','invest','maintain','maintain','mandate_altia_1','mandate_altia_1','license','invest','maintain','maintain','mandate_altia_2'],
 marin:['expand_routes','emergency_import','mandate_marin_1','mandate_marin_1','treaty:cera:trade_buy:1:3:8','maintain','maintain','mandate_marin_2'],
 solis:['resilience','invest','maintain','maintain','mandate_solis_1','mandate_solis_1','invest','maintain','maintain','mandate_solis_2'],
};

test('all six default V25 campaigns retain a bounded legal path through every national mandate stage',()=>{
 for(const playerId of COUNTRY_IDS){
  let state=createGame(playerId),executed=0;
  for(const planned of plans[playerId]){
   let waits=0;
   while(!getAction(state,planned)&&waits<80){assert.ok(getAction(state,'maintain'));state=advanceTurn(state,'maintain');waits++;executed++;}
   assert.ok(getAction(state,planned),`${playerId} cannot reach ${planned} after ${waits} legal waits`);
   state=advanceTurn(state,planned);executed++;
  }
  assert.deepEqual(state.objectives.completed.map(item=>item.stage),[1,2,3],`${playerId} mandate path`);
  assert.ok(executed<=100,`${playerId} used ${executed} commands`);
  assert.equal(state.foreignSiteStartTurn,1);assert.ok(state.foreignSites,`${playerId} must prove viability with V25 active`);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../dist/engine.mjs';
import {runJointInvestments} from '../dist/joint-investments.mjs';

test('port dividends preserve host reserve20, cap partial payouts, and do not accrue unpaid debt',()=>{
 for(const treasury of [20,21,25]){
  const state=createGame();state.turn=3;state.countries.lumen.treasury=40;state.countries.nord.treasury=treasury;
  state.jointInvestments=[{id:'reserve-port',targetId:'nord',kind:'port',capital:20,share:75,duration:4,startTurn:3,dueTurn:3,endTurn:7,status:'active',totalFood:0,totalRevenue:0,accruedOutput:0,accountedEntitlement:0,lastReason:'active'}];
  const output=[{source:'foreign_site',countryId:'nord',kind:'port',operation:'passive',money:4}];
  const result=runJointInvestments(state,[],output);
  const expected=Math.min(3,treasury-20);
  assert.equal(result[0].revenue,expected,`Treasury ${treasury}: payout must use only money above reserve20`);
  assert.equal(state.countries.nord.treasury,treasury-expected);assert.ok(state.countries.nord.treasury>=20);
  assert.equal(state.countries.lumen.treasury,40+expected);assert.equal(state.countries.nord.treasury+state.countries.lumen.treasury,treasury+40);
  state.turn=4;state.countries.nord.treasury=30;
  const later=runJointInvestments(state,[],[{source:'foreign_site',countryId:'nord',kind:'port',operation:'passive',money:0}]);
  assert.equal(later[0].revenue,0);assert.equal(state.jointInvestments[0].totalRevenue,expected);assert.equal(state.jointInvestments[0].accountedEntitlement,3);
 }
});

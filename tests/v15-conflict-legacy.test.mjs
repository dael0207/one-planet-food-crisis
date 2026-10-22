import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createGame,advanceTurn} from '../dist/engine.mjs';

const fixtures=JSON.parse(readFileSync(new URL('./fixtures/v14-conflict-replay.json',import.meta.url),'utf8'));
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const v14Hash=state=>{
 const {version,conflictStartTurn,goalConflicts,lastConflictEvents,conflictCooldownUntil,mediationStartTurn,mediations,lastMediationEvents,mediationOfferTurnByConflict,peaceOfferStartTurn,peaceOffers,lastPeaceOfferEvents,peaceComplianceStartTurn,peaceAccords,lastPeaceComplianceEvents,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn,...v14}=state;
 return createHash('sha256').update(JSON.stringify(sorted(v14))).digest('hex');
};

test('six V14 campaigns remain byte-equivalent before conflict activation',()=>{
 for(const fixture of fixtures){
  let state=createGame(fixture.playerId,{conflictStartTurn:fixture.commands.length+1,foreignSiteStartTurn:fixture.commands.length+1,jointStartTurn:fixture.commands.length+1,foreignStrategyStartTurn:fixture.commands.length+1});
  for(const command of fixture.commands)state=advanceTurn(state,command);
  assert.equal(v14Hash(state),fixture.expectedSha256,fixture.playerId);
  assert.equal(state.goalConflicts.length,0);
 }
});

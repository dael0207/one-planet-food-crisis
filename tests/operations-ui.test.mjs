import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,COUNTRY_IDS} from '../dist/engine.mjs';
import {renderCountryIntel} from '../dist/room-map-ui.mjs';
import {renderOperatingHorizon,commandTarget} from '../dist/operations-ui.mjs';

test('map inspection offers targeted commands only during decision',()=>{
 const state=createGame('lumen');
 const html=renderCountryIntel(state,'cera','decision');
 assert.match(html,/data-action="open-proposal" data-country="cera"/);
 assert.match(html,/data-action="open-treaty" data-country="cera"/);
 assert.doesNotMatch(renderCountryIntel(state,'cera','result'),/data-action="open-(proposal|treaty)"/);
 for(const player of COUNTRY_IDS){const game=createGame(player);assert.notEqual(commandTarget(game,player),player);assert.equal(commandTarget(game,'invalid'),COUNTRY_IDS.find(id=>id!==player));}
 assert.equal(commandTarget(state,'cera'),'cera');
});

test('operating horizon exposes real construction milestones without mutating state',()=>{
 let state=createGame('lumen');
 state=advanceTurn(state,'invest');
 const before=JSON.stringify(state);
 assert.match(renderOperatingHorizon(state,'result'),/2분기 뒤 완공/);
 assert.match(renderOperatingHorizon(state,'result'),/data-milestone="started"/);
 assert.doesNotMatch(renderOperatingHorizon(state,'decision'),/data-milestone=/);
 assert.equal(JSON.stringify(state),before);
 state=advanceTurn(advanceTurn(state,'maintain'),'maintain');
 assert.match(renderOperatingHorizon(state,'result'),/1\/3단계 운영/);
 assert.match(renderOperatingHorizon(state,'result'),/data-milestone="completed"/);
});

test('operating horizon shows actual treaty fulfillment and both reliability values',()=>{
 const state=advanceTurn(createGame('lumen'),'treaty:nord:trade_buy:3:6:4');
 const treaty=state.treaties.find(t=>t.status==='active');assert.ok(treaty);
 const html=renderOperatingHorizon(state,'result');
 assert.match(html,new RegExp(`이행 ${treaty.fulfilled}/4회`));
 assert.match(html,new RegExp(`우리 ${state.reliability.lumen} · 상대 ${state.reliability.nord}`));
 assert.match(html,/노르드/);
});

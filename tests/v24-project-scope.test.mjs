import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,PROFILES} from '../dist/engine.mjs';
import {getScenario} from '../dist/scenarios.mjs';
import {renderMetrics} from '../dist/render.mjs';
import {renderOutcome} from '../dist/experience.mjs';
const nationalCount=state=>Number(renderMetrics(state).split(PROFILES[state.playerId].facilityName)[1]?.match(/class="metric-delta">([^<]*)/)?.[1]?.match(/\d+/)?.[0]??0);

test('a city project cannot be presented as national irrigation construction',()=>{
 const state=advanceTurn(createGame('lumen'),'site:city:upgrade');
 assert.equal(state.farmLevel,0);assert.equal(state.projects[0].type,'site');
 assert.ok(!getScenario(state).title.includes(PROFILES.lumen.facilityName));
 assert.equal(nationalCount(state),0);
});

test('mixed project metrics and result continuation retain the separate national countdown',()=>{
 const state=advanceTurn(advanceTurn(createGame('lumen'),'site:city:upgrade'),'invest');
 assert.equal(state.projects.length,2);assert.equal(nationalCount(state),1);
 const next=renderOutcome(state).match(/class="next-consequence">[\s\S]*?<p>(.*?)<\/p>/)?.[1]??'';
 assert.ok(next.includes(PROFILES.lumen.facilityName));assert.ok(next.includes('1'));
});

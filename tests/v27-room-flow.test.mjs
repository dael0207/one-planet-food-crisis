import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {renderOutcome} from '../dist/experience.mjs';

test('investment result places causal summary ahead of secondary calculations and has one continuation',()=>{
 const state=advanceTurn(createGame(),'invest'),before=structuredClone(state);
 const html=renderOutcome(state);
 assert.ok(html.indexOf('data-result-causes')>=0);
 assert.ok(html.indexOf('data-result-causes')<html.indexOf('class="result-totals"'));
 assert.match(html,/<details class="result-reconciliation">/);
 assert.match(html,/<details class="result-investment-details">/);
 assert.equal((html.match(/data-action="next-quarter"/g)??[]).length,1);
 assert.deepEqual(state,before);
});

test('map instruments are collapsed by default and priorities share existing command dock',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/<details class="atlas-tools"><summary>/);
 assert.match(html,/id="map-consequences"/);
 assert.match(html,/<aside class="command-dock"[^>]*>\s*<div id="quarter-priority"/);
 assert.ok(html.indexOf('id="map-network-controls"')>html.indexOf('class="atlas-tools"'));
});

test('priority and recorded map focus bridge inspect existing paths without committing commands',async()=>{
 const app=await readFile(new URL('../dist/app.mjs',import.meta.url),'utf8');
 const priority=app.match(/function inspectPriority\(\)\{([\s\S]*?)\n\}/)?.[1]??'';
 const focus=app.match(/function focusMapChange\(id\)\{([\s\S]*?)\n\}/)?.[1]??'';
 assert.match(priority,/quarterPriority\(state\)/);
 assert.match(priority,/\.focus\(/);
 assert.match(focus,/mapConsequences\(state\)/);
 assert.doesNotMatch(priority+focus,/commitDecision\(|advanceTurn\(|\.checked\s*=/);
});

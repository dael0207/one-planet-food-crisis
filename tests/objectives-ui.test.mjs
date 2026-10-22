import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,COUNTRY_IDS} from '../dist/engine.mjs';
import {getObjectiveView} from '../dist/objectives.mjs';
import {renderObjectiveRail,renderObjectiveAchievements} from '../dist/objectives-ui.mjs';
import {renderOutcome} from '../dist/experience.mjs';

test('six national mandates expose exact current requirements and the next policy unlock',()=>{
 const titles=[];
 for(const id of COUNTRY_IDS){
  const state=createGame(id),view=getObjectiveView(state),before=JSON.stringify(state);
  const html=renderObjectiveRail(state);titles.push(view.title);
  assert.ok(html.includes(view.title));assert.ok(html.includes(view.nextUnlock.name));
  assert.match(html,/국가 목표 · 0\/3 달성/);assert.match(html,/<details class="mandate-roadmap">/);
  for(const item of view.requirements)assert.ok(html.includes(`${item.current}/${item.target}`));
  assert.equal(JSON.stringify(state),before);assert.equal(renderObjectiveAchievements(state),'');
 }
 assert.equal(new Set(titles).size,6);
});

test('achievement and new policy appear once in the actual completion report, not every later quarter',()=>{
 let state=createGame('lumen');for(const id of ['balanced','invest','maintain','maintain'])state=advanceTurn(state,id);
 const html=renderOutcome(state,0);
 assert.equal((html.match(/class="mandate-achievement"/g)??[]).length,1);
 assert.match(html,/국가 목표 1단계 달성/);assert.match(html,/새 명령 개방/);
 assert.match(renderObjectiveRail(state),/국가 목표 · 1\/3 달성/);
 state=advanceTurn(state,'mandate_lumen_1');
 assert.equal(renderObjectiveAchievements(state),'');
});

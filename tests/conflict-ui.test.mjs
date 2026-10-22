import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,COUNTRY_IDS} from '../dist/engine.mjs';
import {activeConflicts,conflictAction} from '../dist/goal-conflicts.mjs';
import {renderConflictBrief,renderConflictReview,renderConflictResults,renderConflictWorld,conflictCountryLabel} from '../dist/conflict-ui.mjs';

function dispute(playerId='lumen'){
 let state=createGame(playerId);
 for(let index=0;index<12&&!activeConflicts(state).length;index++)state=advanceTurn(state,'maintain');
 assert.ok(activeConflicts(state).length,playerId);return state;
}

test('opening has no conflict panel and all countries retain an undeclared choice when a dispute arrives',()=>{
 assert.equal(renderConflictBrief(createGame()),'');
 for(const id of COUNTRY_IDS){const state=dispute(id),conflict=activeConflicts(state)[0];
  assert.equal(conflict.playerStance,null);assert.equal(conflictCountryLabel(state,id),'');
  assert.match(renderConflictBrief(state),/입장 미정/);assert.match(renderConflictBrief(state),/우리 입장 검토/);
 }
});

test('each stance review renders the authoritative terms without advancing or mutating the campaign',()=>{
 const state=dispute(),before=structuredClone(state),conflict=activeConflicts(state)[0];
 const html=renderConflictReview(state,conflict.id);
 assert.equal((html.match(/type="radio"/g)??[]).length,3);
 for(const stance of ['sanction','response','neutral']){const action=conflictAction(state,`stance:${conflict.id}:${stance}`);assert.ok(html.includes(action.forecast));}
 assert.match(html,/검토 중에는 시간이 흐르지 않습니다/);assert.match(html,/id="advance-button" disabled/);assert.deepEqual(state,before);
});

test('result pause disables stance review controls instead of sending a second command',()=>{
 const state=dispute();assert.match(renderConflictBrief(state,'result'),/disabled/);assert.match(renderConflictWorld(state,'result'),/disabled/);
});

test('all three chosen sides have truthful map membership and a remaining effect report',()=>{
 const state=dispute(),conflict=activeConflicts(state)[0];
 for(const stance of ['sanction','response','neutral']){
  const next=advanceTurn(state,`stance:${conflict.id}:${stance}`),html=renderConflictResults(next);
  assert.match(html,/제재와 공동 대응/);assert.match(html,/앞으로 3분기/);
  assert.equal(conflictCountryLabel(next,next.playerId),{sanction:'제재 연합',response:'공동 대응',neutral:'중립'}[stance]);
  assert.doesNotMatch(html,/우리 입장은 아직 미정/);
 }
});

test('completed disputes leave readable history without a live map alert or stale stance control',()=>{
 let state=dispute(),conflict=activeConflicts(state)[0];
 state=advanceTurn(state,`stance:${conflict.id}:neutral`);
 while(state.turn<conflict.endTurn)state=advanceTurn(state,'maintain');
 assert.equal(renderConflictBrief(state),'');assert.match(renderConflictWorld(state),/기간 종료/);assert.doesNotMatch(renderConflictWorld(state),/data-action="review-conflict"/);
 assert.match(renderConflictResults(state),/종료/);
});

test('foreign dispatch text is escaped in review, result and archive',()=>{
 const state=dispute(),conflict=activeConflicts(state)[0];conflict.reason='<img src=x onerror=alert(1)>';
 state.lastConflictEvents=[{type:'support',text:'<script>alert(1)</script>'}];
 for(const html of [renderConflictReview(state,conflict.id),renderConflictResults(state),renderConflictWorld(state)])assert.doesNotMatch(html,/<(?:img|script)[ >]/);
});

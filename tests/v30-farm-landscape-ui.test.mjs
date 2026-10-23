import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {renderFarmLandscape,renderFarmResult} from '../dist/farm-landscape-ui.mjs';
import {renderSitePanel} from '../dist/site-ui.mjs';

test('farm inspector distinguishes completed drought from inventory and future weather',()=>{
 const opening=createGame('lumen'),before=structuredClone(opening);
 assert.match(renderFarmLandscape(opening,'lumen'),/아직 완료한 기후 기록 없음/);
 const drought=advanceTurn(opening,'site:farm:upgrade'),html=renderFarmLandscape(drought,'lumen');
 assert.match(html,/가뭄 진행/);assert.match(html,/2031년 1분기/);assert.match(html,/기후·수확/);
 assert.match(html,/2분기 뒤/);assert.doesNotMatch(html,/가뭄 피해.*감소|피해율/);
 assert.deepEqual(opening,before);assert.equal(renderFarmLandscape(opening,'invalid'),'');
});

test('completed investment and recovery remain distinct from new food reward',()=>{
 let state=createGame();for(let index=0;index<6;index++)state=advanceTurn(state,index===0?'site:farm:upgrade':'maintain');
 const before=structuredClone(state),html=renderFarmLandscape(state,'lumen');
 assert.match(html,/회복/);assert.match(html,/경작지 1\/3단계/);assert.match(html,/비축 식량과 땅의 상태는 다릅니다/);
 assert.match(renderFarmResult(state),/농경지/);assert.match(renderFarmResult(state),/data-action="open-facility"/);
 assert.deepEqual(state,before);
});

test('only farm facility panels gain climate intel and querying cannot execute commands',()=>{
 const state=advanceTurn(createGame(),'maintain'),before=structuredClone(state);
 assert.match(renderSitePanel(state,{countryId:'lumen',kind:'farm'},'decision'),/data-farm-landscape/);
 assert.doesNotMatch(renderSitePanel(state,{countryId:'lumen',kind:'city'},'decision'),/data-farm-landscape/);
 assert.doesNotMatch(renderSitePanel(state,{countryId:'lumen',kind:'port'},'decision'),/data-farm-landscape/);
 assert.match(renderSitePanel(state,{countryId:'cera',kind:'farm'},'result'),/data-farm-landscape/);
 assert.deepEqual(state,before);
});

test('completed recovery is announced once and seasonal crop loss does not claim stable harvest',()=>{
 let state=createGame('cera');for(let index=0;index<8;index++)state=advanceTurn(state,'maintain');
 assert.equal(renderFarmResult(state),'');
 const seasonal={...state,history:state.history.filter(record=>record.turn===8)};
 assert.match(renderFarmLandscape(seasonal,'cera'),/가뭄 흔적 없음/);
 assert.doesNotMatch(renderFarmLandscape(seasonal,'cera'),/작황 안정/);
});

test('national production works keep their real name and do not become local farm expansion',()=>{
 const state=advanceTurn(createGame('lumen'),'invest');
 const html=renderFarmLandscape(state,'lumen');
 assert.match(html,/관개 시설 1단계 공사/);assert.match(html,/2분기 뒤 완공/);
 assert.match(html,/경작지 0\/3단계/);
});

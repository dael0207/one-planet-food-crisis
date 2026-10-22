import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,COUNTRY_IDS,COUNTRIES,PROFILES} from '../dist/engine.mjs';
import {renderMetrics,renderCountry,renderCountryTabs,reviewContent} from '../dist/render.mjs';
import {renderOutcome,renderOngoing} from '../dist/experience.mjs';
import {countryPicker} from '../dist/country-picker.mjs';
test('player presentation follows each real country rather than Lumen',()=>{
 for(const id of COUNTRY_IDS){
  let state=createGame(id);const metrics=renderMetrics(state);
  assert.ok(metrics.includes(`${state.countries[id].treasury}<span class="metric-unit">억`));
  assert.ok(renderCountry(state,id).includes('YOUR COUNTRY'));
  const other=COUNTRY_IDS.find(item=>item!==id);assert.ok(!renderCountry(state,other).includes('YOUR COUNTRY'));
  assert.ok(renderCountryTabs(state,id).includes(`${COUNTRIES[id].name} <span>내 나라`));
  assert.ok(renderOngoing(state).includes(PROFILES[id].facilityName));
  state=advanceTurn(state,'maintain');
  assert.ok(renderOutcome(state,0).includes(`${COUNTRIES[id].name} · 이번 분기 최종 식량`));
  assert.ok(reviewContent(state).includes(`${COUNTRIES[id].name}, 지금까지`));
 }
});
test('country picker compares actual starts and preserves existing campaign labels',()=>{
 const html=countryPicker('nord',{nord:17,solis:3});
 assert.equal((html.match(/name="nation"/g)??[]).length,6);
 assert.ok(html.includes('저장된 운영 · 17분기 완료'));
 for(const id of COUNTRY_IDS){assert.ok(html.includes(COUNTRIES[id].name));assert.ok(html.includes(PROFILES[id].challenge));}
});

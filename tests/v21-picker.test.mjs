import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRIES,COUNTRY_IDS,PROFILES} from '../dist/engine.mjs';
import {countryPicker,countryStartLabel} from '../dist/country-picker.mjs';
import {getObjectivePlan} from '../dist/objectives.mjs';

test('country start label treats a zero-turn slot as a first-quarter start',()=>{
 const firstStart=countryStartLabel('lumen',{lumen:0});
 const continuation=countryStartLabel('lumen',{lumen:7});

 assert.equal(firstStart.continuing,false);
 assert.doesNotMatch(firstStart.status,/저장|이어/);
 assert.match(firstStart.selection,/루멘.*첫 분기/);
 assert.match(firstStart.action,/루멘.*시작/);
 assert.equal(continuation.continuing,true);
 assert.match(continuation.status,/7분기 완료/);
 assert.match(continuation.selection,/루멘.*7분기.*이어/);
 assert.match(continuation.action,/루멘.*이어/);
});

test('country picker exposes six native choices and one selectable summary per country',()=>{
 const html=countryPicker('marin',{lumen:0,marin:4});

 assert.equal((html.match(/type="radio" name="nation"/g)??[]).length,COUNTRY_IDS.length);
 assert.equal((html.match(/data-nation-summary=/g)??[]).length,COUNTRY_IDS.length);
 assert.match(html,/value="marin"[^>]*checked/);
 assert.match(html,/id="nation-start-button"/);
 assert.match(html,/>마린 이어하기</);
 for(const id of COUNTRY_IDS){
  assert.ok(html.includes(COUNTRIES[id].name));
  assert.ok(html.includes(PROFILES[id].roleLabel??COUNTRIES[id].roleLabel));
  assert.ok(html.includes(PROFILES[id].difficulty));
  assert.ok(html.includes(PROFILES[id].challenge));
  assert.equal(html.split(getObjectivePlan(id).title).length-1,1);
 }
});

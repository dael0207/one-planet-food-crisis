import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,COUNTRY_IDS,getAction} from '../dist/engine.mjs';
import {siteOrder,renderSitePanel,renderSiteSelector,renderSiteResults} from '../dist/site-ui.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';

test('all countries have actionable own site selectors and foreign inspection-only orders',()=>{
 for(const id of COUNTRY_IDS){
  const state=createGame(id),foreign=COUNTRY_IDS.find(other=>other!==id),before=structuredClone(state);
  const html=renderSiteSelector(state,id);
  assert.equal((html.match(/data-action="open-facility"/g)??[]).length,3);
  for(const kind of ['city','port','farm']){
   const own=siteOrder(state,{countryId:id,kind},'decision','upgrade');
   assert.equal(own.action.id,`site:${kind}:upgrade`);assert.equal(own.reason,'');
   assert.ok(siteOrder(state,{countryId:foreign,kind},'decision','upgrade').reason);
   const remote=renderSitePanel(state,{countryId:foreign,kind},'decision');
   assert.ok(!remote.includes('id="site-form"'));assert.ok(remote.includes('data-action="open-proposal"'));
  }
  assert.deepEqual(state,before);
 }
});

test('review phase locks site operations and invalid kinds cannot construct commands',()=>{
 const state=createGame('lumen'),selection={countryId:'lumen',kind:'farm'};
 assert.ok(siteOrder(state,selection,'result','upgrade').reason);
 assert.equal(siteOrder(state,selection,'decision','erase'),null);
 assert.equal(siteOrder(state,{countryId:'invalid',kind:'farm'},'decision','manage'),null);
 const html=renderSitePanel(state,selection,'result');
 assert.ok(!html.includes('id="site-form"'));
 assert.ok(html.includes('data-action="close-facility"'));
});

test('canonical unavailable funds and construction lock investment without blocking management',()=>{
 const poor=createGame('solis');poor.countries.solis.treasury=0;
 const selection={countryId:'solis',kind:'city'};
 assert.ok(siteOrder(poor,selection,'decision','upgrade').reason);
 const start=advanceTurn(createGame('cera'),'site:farm:upgrade');
 assert.equal(siteOrder(start,{countryId:'cera',kind:'farm'},'decision','upgrade').action,null);
 assert.ok(siteOrder(start,{countryId:'cera',kind:'farm'},'decision','manage').action);
 assert.ok(renderSiteResults(start).includes('data-site-result="started"'));
 const complete=advanceTurn(advanceTurn(start,'maintain'),'maintain');
 assert.ok(renderSiteResults(complete).includes('data-site-result="completed"'));
 assert.equal(getAction(complete,'site:farm:upgrade').cost,16);
});

test('site upgrade costs are included in the existing investment history graph',()=>{
 const state=advanceTurn(createGame('lumen'),'site:farm:upgrade');
 const chronicle=buildChronicle(state);
 assert.equal(chronicle.points.at(-1).investmentCost,12);
 assert.equal(chronicle.points.at(-1).cumulativeInvestmentCost,12);
});

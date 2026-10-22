import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,siteView} from '../dist/engine.mjs';
import {renderForeignSiteResults} from '../dist/foreign-sites-ui.mjs';
import {renderSitePanel,renderSiteSelector} from '../dist/site-ui.mjs';
import {mapRoutes} from '../dist/map-geometry.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';

test('a real autonomous foreign project is public and inspectable without granting player authority',()=>{
 const state=advanceTurn(createGame('lumen'),'maintain');
 const project=state.history.at(-1).foreignSiteDevelopment.started[0];
 const view=siteView(state,project.countryId,project.siteKind);
 assert.equal(view.level,0);assert.equal(view.stage,'started');
 const panel=renderSitePanel(state,{countryId:project.countryId,kind:project.siteKind},'decision');
 assert.match(panel,/data-foreign-site-info/);assert.match(panel,/공사 중/);assert.match(panel,/완공 뒤부터/);
 assert.ok(!panel.includes('id="site-form"'));assert.ok(!panel.includes('단계 미확인'));
 assert.match(renderSiteSelector(state,project.countryId),/공사 중/);
 const results=renderForeignSiteResults(state);assert.match(results,/data-foreign-site-results/);assert.ok(results.includes(project.countryId));
});

test('shipment arrows follow actual food direction even when the initiating port is the buyer',()=>{
 const state=createGame('lumen');
 state.history=[{worldActions:[{countryId:'nord',targetId:'cera',type:'trade',source:'foreign_site',shipmentFromId:'cera',shipmentToId:'nord',food:3}]}];
 const shipment=mapRoutes(state).find(route=>route.source==='foreign_site');
 assert.equal(shipment.countryId,'cera');assert.equal(shipment.targetId,'nord');assert.equal(shipment.food,3);
});

test('actual foreign commerce is surfaced separately from other countries domestic spending',()=>{
 let state=createGame('solis'),trade=null;
 for(let turn=0;turn<50&&!trade;turn++){
  state=advanceTurn(state,'maintain');
  trade=state.history.at(-1).foreignSiteOperations?.find(event=>event.playerImpact?.food>0);
 }
 assert.ok(trade,'a real developed port supplies the player');
 assert.ok(mapRoutes(state).some(route=>route.source==='foreign_site'&&route.type==='trade'&&route.countryId===trade.shipmentFromId&&route.targetId===state.playerId),'real facility commerce is visible as a food shipment on the map');
 const html=renderForeignSiteResults(state);assert.match(html,/data-foreign-site-impact/);assert.ok(html.includes(trade.text));
 assert.match(html,/实际|실제 식량/);assert.ok(!renderSitePanel(state,{countryId:trade.countryId,kind:'port'},'result').includes('id="site-form"'));
 const model=buildChronicle(state),last=model.points.at(-1);
 assert.equal(model.coverage,'complete');assert.equal(last.metrics.food,state.countries.solis.food);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {renderChronicle,normalizeChronicleOptions} from '../dist/chronicle-ui.mjs';
test('local farm production and completion remain visible in investment history',()=>{
 const start=advanceTurn(createGame('lumen'),'site:farm:upgrade');const state=advanceTurn(advanceTurn(start,'maintain'),'maintain');
 const model=buildChronicle(state),last=model.points.at(-1);
 assert.equal(last.facilityProduction,3);assert.equal(last.cumulativeFacilityProduction,3);assert.equal(last.facilityLevel,0);
 assert.equal(last.siteDevelopment.completed[0].siteKind,'farm');
 const options=normalizeChronicleOptions(model,{filter:'investment',turn:3});
 assert.ok(renderChronicle(model,options).includes('data-action="chronicle-turn" data-turn="3"'));
});

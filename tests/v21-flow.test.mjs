import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame} from '../dist/engine.mjs';
import {renderDecision,renderOutcome} from '../dist/experience.mjs';
import {escape,signed} from '../dist/render.mjs';
import {getScenario} from '../dist/scenarios.mjs';

test('domestic narrative is disclosed on demand while live diplomatic terms remain visible',()=>{
 // Given: the opening domestic decision and a live diplomatic request.
 const state=createGame();
 const requestId=state.requests[0].id;

 // When: both decision surfaces are rendered.
 const domestic=renderDecision(state,null);
 const request=renderDecision(state,null,requestId);
 const domesticEvent=getScenario(state);
 const requestEvent=getScenario(state,requestId);

 // Then: domestic narrative stays in the closed context and request terms stay expanded.
 assert.ok(domestic.indexOf('class="decision-brief"')>domestic.indexOf('class="decision-context"'));
 assert.ok(domestic.indexOf(escape(domesticEvent.description))>domestic.indexOf('class="decision-context"'));
 assert.match(domestic,/<details class="decision-context">[\s\S]*?<p>[^<]+<\/p><\/details>/);
 assert.ok(request.indexOf(escape(requestEvent.description))<request.indexOf('class="decision-context"'));
 assert.match(request,/<details class="decision-context" open>/);
 assert.match(domestic,/data-stage="choice"/);
});

test('V21 result promotes actual holdings and bilateral policy effects before continuation',()=>{
 // Given: a completed policy choice with both aggregate changes and a bilateral effect.
 const state=advanceTurn(createGame(),'balanced');
 const last=state.history.at(-1);
 const before=last.beforeCountries[state.playerId];
 const after=state.countries[state.playerId];
 const relation=last.policyRelationEffects[0];

 // When: the paused result is rendered.
 const html=renderOutcome(state,0);
 const totals=html.indexOf('class="result-totals"');
 const comparison=html.indexOf('data-comparison="maintain"');
 const continuation=html.indexOf('data-action="next-quarter"');

 // Then: real ledger values and the real relation delta are inspectable before moving on.
 assert.ok(totals>=0&&totals<comparison&&comparison<continuation);
 assert.match(html,new RegExp(`data-metric="food" data-before="${before.food}" data-after="${after.food}" data-delta="${after.food-before.food}"`));
 assert.match(html,new RegExp(`data-metric="treasury" data-before="${before.treasury}" data-after="${after.treasury}" data-delta="${after.treasury-before.treasury}"`));
 assert.match(html,new RegExp(`data-policy-relation="${relation.countryId}" data-before="${relation.before}" data-after="${relation.after}" data-delta="${relation.effect}"`));
 assert.ok(html.slice(totals,comparison).includes(signed(after.food-before.food)));
 assert.match(html,/data-stage="result"/);
});

test('V21 continuation identifies the actual next quarter without advancing state',()=>{
 // Given: four executed quarters ending at the year boundary.
 let state=createGame();
 for(let turn=0;turn<4;turn+=1)state=advanceTurn(state,'maintain');
 const before=structuredClone(state);

 // When: the fourth-quarter result is rendered.
 const html=renderOutcome(state,0);

 // Then: the single continuation points to 2032 Q1 while rendering remains side-effect free.
 assert.match(html,/class="result-continuation-rail" data-next-year="2032" data-next-quarter="1"/);
 assert.equal((html.match(/data-action="next-quarter"/g)??[]).length,1);
 assert.deepEqual(state,before);
 const calculation=html.indexOf('class="calculation-question"');
 assert.ok(html.indexOf('data-action="next-quarter"')<calculation);
});

test('V21 focused command and result identify calendar quarters across a year boundary',()=>{
 let state=createGame('cera');
 for(let turn=0;turn<4;turn+=1)state=advanceTurn(state,'maintain');
 const result=renderOutcome(state,0),decision=renderDecision(state,null);
 assert.match(result,/data-calendar-year="2031" data-calendar-quarter="4"/);
 assert.match(decision,/data-calendar-year="2032" data-calendar-quarter="1"/);
});

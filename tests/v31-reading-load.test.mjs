import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGame} from '../dist/engine.mjs';
import {renderDecision} from '../dist/experience.mjs';
import {renderQuarterPriority,quarterPriority} from '../dist/quarter-priority.mjs';
import {getScenario} from '../dist/scenarios.mjs';

test('main footer only offers restart and supplementary reports live in Records',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const footer=html.match(/<footer>([\s\S]*?)<\/footer>/)[1];
 assert.equal(footer.trim(),'<button class="text-button" id="restart-button">처음부터 다시</button>');
 assert.doesNotMatch(html,/끝없이 이어지는 세계|모든 나라는 연결되어|class="save-strip"/);
 assert.doesNotMatch(html,/id="review-button"/);
 const records=html.match(/<section id="records-view"[\s\S]*?(?=\n  <footer>)/)?.[0]??'';
 assert.match(records,/id="metrics"/);assert.match(records,/id="report"/);
 assert.match(html,/id="save-status"[^>]*hidden/);
});

test('priority keeps the exact recommendation and action behind one closed disclosure',()=>{
 const state=createGame(),before=JSON.stringify(state),priority=quarterPriority(state);
 const html=renderQuarterPriority(state);
 assert.match(html,/^<details class="quarter-priority"[^>]*><summary>/);
 assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
 const summary=html.match(/<summary>([\s\S]*?)<\/summary>/)[1];
 assert.ok(summary.includes(priority.title));assert.ok(!summary.includes(priority.reason));
 assert.ok(html.includes(priority.reason));assert.match(html,/data-action="inspect-priority"/);
 assert.equal(JSON.stringify(state),before);
});

test('domestic background is optional while command tradeoffs and live diplomatic terms remain available',()=>{
 const state=createGame(),before=JSON.stringify(state),domestic=renderDecision(state,null);
 const context=domestic.match(/<details class="decision-context">([\s\S]*?)<\/details>/)[1];
 assert.ok(context.includes(getScenario(state).description));
 assert.doesNotMatch(domestic.slice(0,domestic.indexOf('<details class="decision-context"')),/class="decision-brief"/);
 assert.equal((domestic.match(/<b>효과<\/b>/g)??[]).length>=3,true);
 assert.equal((domestic.match(/<b>대가<\/b>/g)??[]).length>=3,true);
 const requestId=state.requests[0].id,request=renderDecision(state,null,requestId);
 assert.ok(request.indexOf(getScenario(state,requestId).description)<request.indexOf('<details class="decision-context"'));
 assert.match(request,/<details class="decision-context" open>/);
 assert.equal(JSON.stringify(state),before);
});

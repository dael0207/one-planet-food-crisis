import test from 'node:test';
import assert from 'node:assert/strict';

import {createGame,advanceTurn} from '../dist/engine.mjs';
import {renderCommandReview} from '../dist/command-preview-ui.mjs';
import {renderMapAttentionHeader,renderMapPin,renderMapPreviewShortcut,resolveMapAttention} from '../dist/map-attention-ui.mjs';

const quiet={networkStartTurn:999,policyStartTurn:1,objectiveStartTurn:999,worldGoalStartTurn:999,conflictStartTurn:999,mediationStartTurn:999,peaceOfferStartTurn:999,peaceComplianceStartTurn:999,peaceResponseStartTurn:999,foreignSiteStartTurn:999,jointStartTurn:999,foreignStrategyStartTurn:999};

test('preview and completed-result headers keep forecast and actual semantics distinct',()=>{
 const preview=renderMapAttentionHeader({mode:'preview',heading:'교역 <유지>',notice:'현재 조건 모의계산 · 실행 전',pins:[],metrics:[{key:'food',label:'식량',before:68,after:57,delta:-11,commandEffect:4},{key:'treasury',label:'국고',before:62,after:49,delta:-13,commandEffect:0}]});
 const result=renderMapAttentionHeader({mode:'result',heading:'교역 <유지>',pins:[],metrics:[{key:'food',label:'식량',before:68,after:57,delta:-11},{key:'treasury',label:'국고',before:62,after:49,delta:-13}]});

 assert.match(preview,/미리보기 · 실행 전/);assert.match(preview,/분기 예상/);assert.match(preview,/유지 대비 \+4/);assert.match(preview,/실제 결과 보장 아님/);
 assert.match(preview,/교역 &lt;유지&gt;/);assert.match(preview,/data-action="focus-order"/);assert.match(preview,/data-action="clear-map-preview"/);
 assert.doesNotMatch(preview,/명령 완료|분기 총변화|submit/);
 assert.match(result,/명령 완료/);assert.match(result,/분기 총변화/);assert.doesNotMatch(result,/미리보기|유지 대비|clear-map-preview/);
});

test('decision command selects a preview model while result mode keeps canonical actual state',()=>{
 const decision=createGame('lumen',quiet),result=advanceTurn(decision,'maintain');
 const preview=resolveMapAttention(decision,'decision','balanced');
 const actual=resolveMapAttention(result,'result','balanced');

 assert.equal(preview.mode,'preview');assert.equal(preview.commandId,'balanced');
 assert.equal(actual.mode,'result');assert.notEqual(actual.commandId,'balanced');
 assert.notEqual(resolveMapAttention(decision,'decision','unknown').mode,'preview');
});

test('preview pins and shortcut are escaped native controls without execution actions',()=>{
 const pin=renderMapPin({id:'preview:<id>',countryId:'lumen',siteKind:null,label:'식량 <예상>',value:'68 → 72 예상',tone:'preview',icon:'arrow',action:'focus-order',changeId:null});
 const shortcut=renderMapPreviewShortcut('정책 <검토>',false);
 const back=renderMapPreviewShortcut('정책 <검토>',true);

 assert.match(pin,/data-tone="preview"/);assert.match(pin,/식량 &lt;예상&gt;/);assert.doesNotMatch(pin,/submit|advance/);
 assert.match(shortcut,/type="button"/);assert.match(shortcut,/data-action="focus-map-preview"/);assert.match(shortcut,/지도 미리보기 ↑/);assert.match(shortcut,/정책 &lt;검토&gt;/);
 assert.match(back,/data-action="focus-order"/);assert.match(back,/명령으로 돌아가기 ↓/);assert.doesNotMatch(shortcut+back,/submit|command-review-form/);
});

test('generic command review uses one explicit commit form and labels total forecast versus command difference',()=>{
 const state=createGame('lumen',quiet),before=structuredClone(state);
 const html=renderCommandReview(state,'balanced');

 assert.match(html,/<h2 id="decision-title" tabindex="-1">/);assert.match(html,/현재 조건 모의계산 · 실행 전/);
 assert.match(html,/분기 예상/);assert.match(html,/유지 대비/);assert.match(html,/국고/);assert.match(html,/1분기/);
 assert.match(html,/data-action="focus-map-preview"/);assert.match(html,/data-action="clear-map-preview"/);
 assert.match(html,/<form id="command-review-form"/);assert.equal((html.match(/type="submit"/g)??[]).length,1);
 assert.match(html,/이 명령 실행 · 1분기 진행 →/);assert.deepEqual(state,before);
});

test('invalid and unaffordable commands have no command review',()=>{
 const result=advanceTurn(createGame('lumen',quiet),'maintain'),poor=createGame('lumen',quiet);
 poor.countries.lumen.treasury=0;poor.countries.lumen.food=0;
 assert.equal(renderCommandReview(result,'unknown'),'');
 assert.equal(renderCommandReview(poor,'aid'),'');
 assert.equal(renderCommandReview(null,'balanced'),'');
});

test('stored counteroffer review shows actual transaction terms rather than claiming free acceptance',()=>{
 const state=advanceTurn(createGame('lumen'),'propose:cera:buy:3:3'),record=state.negotiations.at(-1);
 assert.equal(record.status,'countered');
 const html=renderCommandReview(state,`reply:${record.id}:accept`);
 assert.match(html,new RegExp(`식량 ${record.counterTerms.food} 확보 · 국고 ${record.counterTerms.money}억 지급`));
 assert.doesNotMatch(html,/국고 지출 없음/);
});

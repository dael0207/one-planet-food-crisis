import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {previewMediation} from '../dist/mediation.mjs';
import {renderMediationPreview} from '../dist/mediation-ui.mjs';
import {pendingPeaceOffers} from '../dist/peace-offers.mjs';

function campaign(){let state=createGame('lumen');for(let i=0;i<4;i++)state=advanceTurn(state,'maintain');return state;}

test('peace preview exposes both live consent thresholds without calling them probabilities',()=>{
 const state=campaign(),offer=pendingPeaceOffers(state)[0],preview=previewMediation(state,offer.terms),html=renderMediationPreview(state,offer.terms);
 assert.ok(preview);
 for(const reaction of preview.reactions){
  assert.ok(html.includes(`data-consent-country="${reaction.countryId}"`));
  assert.ok(html.includes(`data-consent-score="${reaction.score}"`));
  assert.ok(html.includes(reaction.score>=62?'동의 기준 충족':`동의까지 ${62-reaction.score}점 부족`));
 }
 assert.match(html,/확률이 아닙니다/);
 assert.match(html,/양국 모두 62점 이상/);
});

test('changing peace contributions compares both countries and actual burden against prior draft',()=>{
 const state=campaign(),offer=pendingPeaceOffers(state)[0],before={...offer.terms,food:0,money:0},draft={...before,food:8,money:12};
 const previous=previewMediation(state,before),current=previewMediation(state,draft),snapshot=JSON.stringify(state),html=renderMediationPreview(state,draft,before);
 assert.match(html,/직전 조건과 비교/);
 for(const item of current.reactions){const prior=previous.reactions.find(reaction=>reaction.countryId===item.countryId);assert.ok(html.includes(`${prior.score} → ${item.score}점`));}
 assert.ok(html.includes(`식량 ${previous.costs.food} → ${current.costs.food}`));
 assert.ok(html.includes(`국고 ${previous.costs.money} → ${current.costs.money}`));
 assert.equal(JSON.stringify(state),snapshot);
});

test('peace lever comparison is evaluated by current authoritative preview',()=>{
 const state=campaign(),offer=pendingPeaceOffers(state)[0],draft={...offer.terms,goal:'peace',condition:'target',food:0,money:0};
 const html=renderMediationPreview(state,draft),mutual=previewMediation(state,{...draft,condition:'mutual'});
 assert.match(html,/조건을 바꾸면/);
 assert.match(html,/상호 양보로 변경/);
 for(const reaction of mutual.reactions)assert.ok(html.includes(`${reaction.score}점`));
 assert.match(html,/합의 전에는 지원 자원이 이동하지 않습니다/);
});

test('previous draft from another conflict does not appear as a comparison',()=>{
 const state=campaign(),draft=pendingPeaceOffers(state)[0].terms;
 const html=renderMediationPreview(state,draft,{...draft,conflictId:'goal-conflict-cera-lumen-999'});
 assert.doesNotMatch(html,/직전 조건과 비교/);
});

test('foreign consent is distinct from our ability to fund the settlement',()=>{
 const state=campaign(),draft=pendingPeaceOffers(state)[0].terms;state.countries.lumen.food=0;
 assert.equal(previewMediation(state,draft).outcome,'accepted');
 const html=renderMediationPreview(state,draft);
 assert.match(html,/양국의 동의와 별개로 우리 이행 자원이 부족합니다/);
 assert.match(html,/식량 0 \/ 필요 8/);
});

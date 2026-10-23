import {COUNTRIES} from './country-data.mjs?v=30';
import {escape,signed} from './render.mjs?v=30';

const outcomeName={accepted:'합의 가능',countered:'역제안 예상',rejected:'거절 예상',escalated:'갈등 확대 위험'};
const name=id=>COUNTRIES[id]?.name??id;

export function renderConsent(reactions,previous=null){
 return `<div class="consent-list">${reactions.map(item=>{
  const before=previous?.reactions.find(value=>value.countryId===item.countryId),gap=Math.max(0,62-item.score);
  return `<article data-consent-country="${escape(item.countryId)}" data-consent-score="${item.score}" data-consent-attitude="${escape(item.attitude)}"><header><b>${escape(name(item.countryId))}</b><strong>${item.attitude==='accept'?'수용':item.attitude==='counter'?'조건 조정':'거절'} · ${item.score}점</strong></header><p class="consent-gap">${gap?`동의까지 ${gap}점 부족`:'동의 기준 충족'}${before?` <span>직전보다 ${signed(item.score-before.score)}점</span>`:''}</p><p>${item.reasons.map(escape).join(' · ')}</p></article>`;
 }).join('')}</div>`;
}

export function renderPeaceChange(current,previous){
 if(!previous)return '';
 return `<section class="draft-change" aria-label="평화 조건 변경 비교"><strong>직전 조건과 비교</strong><p>${escape(outcomeName[previous.outcome])} → ${escape(outcomeName[current.outcome])}</p>${current.reactions.map(item=>{const before=previous.reactions.find(value=>value.countryId===item.countryId);return before?`<p>${escape(name(item.countryId))} ${before.score} → ${item.score}점 (${signed(item.score-before.score)})</p>`:'';}).join('')}<p>합의 시 부담 · 식량 ${previous.costs.food} → ${current.costs.food} · 국고 ${previous.costs.money} → ${current.costs.money}억</p></section>`;
}

export function renderPeaceLevers(draft,resolve){
 const alternatives=[
  {label:draft.condition==='target'?'상호 양보로 변경':'대응국 단독 양보로 변경',condition:draft.condition==='target'?'mutual':'target'},
  {label:draft.goal==='peace'?'교역 휴전으로 변경':'분쟁 완전 종결로 변경',goal:draft.goal==='peace'?'relief':'peace'},
  ...(draft.food<8?[{label:`식량 기여 ${draft.food} → ${draft.food+4}`,food:draft.food+4}]:[]),
  ...(draft.money<12?[{label:`국고 기여 ${draft.money} → ${draft.money+6}억`,money:draft.money+6}]:[]),
 ];
 return `<details class="peace-levers"><summary>조건을 바꾸면</summary><p>한 가지 조건만 바꾼 현재 반응입니다. 다른 조건은 유지합니다.</p>${alternatives.map(({label,...change})=>{
  const next=resolve({...draft,...change});
  return next?`<div><strong>${escape(label)}</strong><span>${escape(outcomeName[next.outcome])} · ${next.reactions.map(item=>`${escape(name(item.countryId))} ${item.score}점`).join(' · ')}</span><small>합의 시 식량 ${next.costs.food} · 국고 ${next.costs.money}억</small></div>`:'';
 }).join('')}</details>`;
}

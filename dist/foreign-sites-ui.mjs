import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=30';
import {SITE_DEFS,SITE_KINDS} from './site-operations.mjs?v=30';
import {escape,signed} from './render.mjs?v=30';
import {quarterDate} from './calendar.mjs?v=30';

export function renderForeignSiteInfo(state,view){
 const unknown=view.level===null;
 const benefits=unknown?'':`<div class="site-benefit"><span>완공 단계당 운영 효과</span><strong>${escape(SITE_DEFS[view.kind].benefit)}</strong></div>`;
 const project=view.project;
 const progress=project?`<div class="site-build-progress"><span>착공</span><progress max="2" value="${Math.max(0,Math.min(2,2-view.remaining))}" aria-label="${escape(view.name)} 공사 진행"></progress><span>완공</span><small>${view.remaining}분기 뒤 ${project.level}단계 가동 · 완공 뒤부터 새 단계 효과 발생</small></div>`:'';
 const decision=view.lastDecision;
 const date=decision?quarterDate(Math.max(0,decision.turn-1)):null;
 const latest=decision?`<div class="site-benefit"><span>${date.year}년 ${date.quarter}분기 · 최근 자국 결정</span><strong>${escape(decision.operation==='upgrade'?'시설 확장 착공':SITE_DEFS[view.kind].manageName)}</strong><small>${escape(decision.reason)}</small></div>`:'';
 const explanation=unknown?'개별 시설의 운영 기록은 아직 없습니다. 표시된 국가 시설 기반과 현장 시설 단계는 별개입니다.':'이 나라는 식량·생활물가·예산과 국가 목표에 따라 직접 시설을 운영합니다.';
 return `<div data-foreign-site-info>${benefits}${progress}${latest}<div class="site-access-note"><strong>외국 시설 · 열람 전용</strong><p>${explanation}</p>${state.turn===0?'<small>첫 분기 마감부터 각국의 시설 결정이 기록됩니다.</small>':''}</div></div>`;
}

function eventRow(event){
 const name=COUNTRIES[event.countryId].name,kind=SITE_KINDS.includes(event.kind)?event.kind:null;
 const label=kind?SITE_DEFS[kind].name:'시설 정기 운영';
 const reason=event.reason&&!(event.text??'').includes(event.reason)?`<small>${escape(event.reason)}</small>`:'';
 return `<li data-foreign-site-event="${escape(event.operation??'operation')}" data-country="${event.countryId}"><strong>${escape(name)} · ${escape(label)}</strong><p>${escape(event.text??'')}</p>${reason}${kind?`<button type="button" class="text-button" data-action="open-facility" data-country="${event.countryId}" data-site="${kind}">지도에서 시설 확인 ↗</button>`:''}</li>`;
}

export function renderForeignSiteResults(state){
 const record=state.history?.at(-1);
 const events=(record?.foreignSiteOperations??record?.worldActions?.filter(item=>item.source==='foreign_site')??[]).filter(item=>COUNTRY_IDS.includes(item.countryId)&&item.countryId!==state.playerId);
 if(!events.length)return '';
 const trades=events.filter(event=>event.playerImpact);
 const impact=trades.reduce((sum,event)=>({food:sum.food+(event.playerImpact.food??0),treasury:sum.treasury+(event.playerImpact.treasury??0)}),{food:0,treasury:0});
 const summary=trades.length?`실제 식량 ${signed(impact.food)} · 국고 ${signed(impact.treasury)}억`:'이번 분기 우리나라와의 시설 교역 없음';
 const prominent=trades.length?`<ul>${trades.map(eventRow).join('')}</ul>`:'';
 const others=events.filter(event=>!event.playerImpact);
 return `<section class="site-result-ledger" data-foreign-site-results aria-label="타국 시설과 우리 교역"><div><span>타국 시설과 우리 교역</span><strong data-foreign-site-impact>${escape(summary)}</strong><small>각국의 실제 생산·관리·거래가 이번 분기 재고와 예산에 반영됐습니다.</small></div>${prominent}${others.length?`<details><summary>다른 나라의 시설 결정과 운영 ${others.length}건</summary><ul>${others.map(eventRow).join('')}</ul></details>`:''}</section>`;
}

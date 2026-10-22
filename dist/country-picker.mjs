import {COUNTRIES,COUNTRY_IDS,PROFILES,createGame,getPolicies} from './engine.mjs?v=29';
import {escape} from './render.mjs?v=29';

import {getObjectivePlan} from './objectives.mjs?v=29';

const hiddenPolicyIds=new Set(['maintain','subsidy','invest','reopen','aid']);

export function countryStartLabel(id,saves={}){
 const completed=saves[id]??0,continuing=completed>0,name=COUNTRIES[id].name;
 return {
  continuing,
  status:continuing?`저장된 운영 · ${completed}분기 완료`:'새로운 운영 · 1분기부터',
  selection:continuing?`${name} · ${completed}분기 기록을 이어갑니다`:`${name} · 첫 분기부터 시작합니다`,
  action:`${name} ${continuing?'이어하기':'시작하기'}`
 };
}

function compactCard(id,selected,saves){
 const nation=COUNTRIES[id],profile=PROFILES[id],start=countryStartLabel(id,saves);
 return `<label class="nation-card ${start.continuing?'has-save':''}" data-country="${id}" style="--nation-color:var(--${id})"><input type="radio" name="nation" value="${id}" aria-describedby="nation-summary-${id}" ${selected===id?'checked':''}><span class="nation-swatch" aria-hidden="true"></span><span class="nation-identity"><strong>${escape(nation.name)}</strong><small>${escape(profile.difficulty)}${id==='lumen'?' · 처음 추천':''}</small></span><span class="nation-role">${escape(nation.roleLabel)}</span><span class="nation-save">${escape(start.status)}</span></label>`;
}

function summaryPanel(id){
 const nation=COUNTRIES[id],profile=PROFILES[id],objective=getObjectivePlan(id);
 return `<section class="nation-summary-panel" id="nation-summary-${id}" data-nation-summary="${id}"><div><span class="eyebrow">${escape(nation.roleLabel)} · 핵심 과제</span><h3>${escape(profile.challenge)}</h3></div><p><span>장기 목표</span><strong>${escape(objective.title)}</strong></p></section>`;
}

function detailPanel(id){
 const nation=COUNTRIES[id],profile=PROFILES[id],game=createGame(id),start=game.countries[id];
 const policies=getPolicies(game).filter(action=>!hiddenPolicyIds.has(action.id)).slice(0,2);
 return `<div class="nation-detail" data-nation-detail="${id}"><div><span class="eyebrow">${escape(nation.roleLabel)} · 상세 출발 조건</span><h3>${escape(nation.name)}의 첫 분기</h3><p>${escape(profile.tagline)}</p></div><dl><div><dt>식량 안정</dt><dd>${start.food}</dd></div><div><dt>국고</dt><dd>${start.treasury}억</dd></div><div><dt>생활물가</dt><dd>${start.price}</dd></div></dl><p class="nation-policy-preview"><span>대표 선택지</span>${policies.length?policies.map(action=>escape(action.name)).join(' · '):'국가 상황에 맞는 정책이 첫 사건에 제시됩니다.'}</p></div>`;
}

export function countryPicker(selected,saves={}){
 const safeSelected=COUNTRY_IDS.includes(selected)?selected:COUNTRY_IDS[0],start=countryStartLabel(safeSelected,saves);
 return `<span class="eyebrow">6개국 · 서로 다른 출발점</span><h2 id="country-picker-title">운영할 국가를 선택하세요</h2><p class="picker-intro">역할과 난이도를 비교한 뒤 한 나라를 선택하세요.</p><form id="country-picker-form"><fieldset><legend class="sr-only">운영할 국가 선택</legend><div class="nation-grid">${COUNTRY_IDS.map(id=>compactCard(id,safeSelected,saves)).join('')}</div><div class="nation-summary">${COUNTRY_IDS.map(summaryPanel).join('')}</div><details class="nation-detail-wrap"><summary>선택한 국가의 시작 수치와 대표 정책</summary>${COUNTRY_IDS.map(detailPanel).join('')}</details></fieldset><div class="picker-footer"><span id="nation-selection-label">${escape(start.selection)}</span><button class="primary-button" id="nation-start-button" type="submit">${escape(start.action)}</button></div></form>`;
}

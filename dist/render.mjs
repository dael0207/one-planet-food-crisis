import {nationalProjects} from './project-state.mjs?v=31';
import {getReliability,activeTreaties} from './treaties.mjs?v=31';
import {getRelation,relationLabel} from './negotiations.mjs?v=31';
import {COUNTRIES,COUNTRY_IDS,PROFILES} from './engine.mjs?v=31';
export const escape=text=>String(text).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const signed=value=>`${value>0?'+':''}${value}`;
export function renderMetrics(state){
 const current=state.countries[state.playerId];
 const last=state.history.at(-1);
 const specs=[['food','식량 안정','점'],['treasury','국고','억'],['price','생활물가',''],['approval','정책 지지도','%'],['trust','외교 신뢰','점']];
 return specs.map(([key,label,unit])=>{
  const change=last?.changes.find(item=>item.countryId===state.playerId&&item.metric===key);
  const delta=change?Math.round(change.after-change.before):0;
  const good=key==='price'?delta<0:delta>0;
  return `<div class="metric"><span class="metric-label">${label}</span><span class="metric-value">${Math.round(current[key])}<span class="metric-unit">${unit}</span></span><span class="metric-delta ${delta?(good?'good':'bad'):''}">${delta?signed(delta):'—'}</span></div>`;
 }).join('')+`<div class="metric"><span class="metric-label">${escape(PROFILES[state.playerId].facilityName)}</span><span class="metric-value">${state.farmLevel}<span class="metric-unit">단계</span></span><span class="metric-delta">${nationalProjects(state).length?`${nationalProjects(state).length}건 공사 중`:'시설 운영'}</span></div>`;
}
export function renderCountry(state,id){
 const c=state.countries[id];
 return `<div><h3>${c.name} <span class="eyebrow">${id===state.playerId?'YOUR COUNTRY':escape(COUNTRIES[id].roleLabel)}</span></h3><p>${escape(COUNTRIES[id].description)}</p>${id!==state.playerId?`<p class="bilateral-summary">${escape(COUNTRIES[state.playerId].name)}와의 양국 관계 <strong>${getRelation(state,state.playerId,id)} · ${escape(relationLabel(getRelation(state,state.playerId,id)))}</strong><small>국가 전반의 외교 신뢰와 별도 지표</small><small>약속 신뢰도 ${getReliability(state,id)} / 100</small></p>`:''}</div><div class="country-stats"><div class="country-stat"><span>식량 안정</span><b>${Math.round(c.food)}<small> / 100</small></b></div><div class="country-stat"><span>생활물가</span><b>${Math.round(c.price)}</b></div><div class="country-stat"><span>외교 신뢰</span><b>${Math.round(c.trust)}</b></div></div>`;
}
export function renderCountryTabs(state,selected){
 return COUNTRY_IDS.map(id=>`<button class="country-tab ${selected===id?'active':''}" data-country="${id}" aria-pressed="${selected===id}">${escape(state.countries[id].name)} <span>${id===state.playerId?'내 나라 · ':''}식량 ${state.countries[id].food}</span></button>`).join('');
}
export function renderReport(state){
 const last=state.history.at(-1);
 if(!last)return `<div class="report-card empty-report"><div class="ripple-symbol" aria-hidden="true">◎</div><div><h3>여섯 나라는 이미 움직입니다.</h3><p>외교 전문을 열거나 국내 현안에 대응하세요.<br>한 분기 뒤 외국끼리의 행동도 기록됩니다.</p></div></div><div class="report-card"><h3>하나의 행성, 여섯 개의 선택</h3><p>기술국 알티아는 협력을 제안하고, 해운국 마린은 공급선을 살핍니다. 솔리스의 식탁과 노르드의 물가는 세계의 수확에 연결되어 있습니다.</p><div class="ai-action">외교 제안은 검토만 해서는 실행되지 않습니다. 회신을 결정해야 한 분기가 흐릅니다.</div></div>`;
 return `<article class="report-card"><h3>${last.turn}분기 · 국경을 넘은 변화</h3>${last.causes.slice(0,6).map((cause,i)=>`<div class="cause-row"><span class="cause-index">${i+1}</span><div><b>${escape(cause.from)} → ${escape(cause.to)}</b><p>${escape(cause.text)}</p></div></div>`).join('')}<div class="ai-action">${last.aiActions.map(action=>`${escape(state.countries[action.countryId]?.name??'국제사회')}: ${escape(action.text)}`).join('<br>')}</div></article><article class="report-card"><h3>숫자 너머, 국민의 하루</h3>${last.citizens.map(c=>`<div class="citizen"><span class="avatar" aria-hidden="true">${escape(c.name.slice(0,1))}</span><div><b>${escape(c.name)}</b><small>${escape(c.role)}</small><div class="household-before"><small>지난 분기</small>${escape(c.before)}</div><div class="household-now"><small>이번 분기</small>${escape(c.text)}</div></div></div>`).join('')}</article>`;
}
export function reviewContent(state){
 const c=state.countries[state.playerId];
 return `<span class="eyebrow">A CONTINUING WORLD · ${state.turn} QUARTERS</span><h2>${escape(c.name)}, 지금까지의 운영</h2><p>${state.turn<4?`${state.turn}분기`:`${Math.floor(state.turn/4)}년${state.turn%4?` ${state.turn%4}분기`:""}`} 동안 운영했습니다. 이 회고를 닫으면 같은 세계에서 계속 운영할 수 있습니다.</p><div class="ending-stats"><div><span>식량 안정</span><b>${c.food}</b></div><div><span>국민 지지도</span><b>${c.approval}%</b></div><div><span>외교 신뢰</span><b>${c.trust}</b></div></div><p>진행 중인 협정 ${state.agreements.filter(a=>a.endTurn>state.turn).length+activeTreaties(state).length}건 · 회신을 기다리는 전문 ${state.requests.filter(r=>r.status==='pending').length}건</p><p>${state.playerId==='lumen'?`해외 시장 점유율 ${Math.round(state.marketShare*100)}%. `:''}${escape(PROFILES[state.playerId].facilityName)} ${state.farmLevel}단계. 오늘의 재고와 관계는 다음 계절의 선택으로 이어집니다.</p><div class="dialog-actions"><button class="secondary-button" data-action="chronicle">최근 연대기</button><button class="primary-button" data-action="cancel">계속 운영하기 →</button></div>`;
}
export function historyContent(state){
 const entries=state.history.slice(-30).toReversed();
 return `<h2>${escape(COUNTRIES[state.playerId].name)}의 연대기</h2><p>총 ${state.turn}분기 중 최근 ${entries.length}분기의 결정을 최신순으로 보여줍니다. 매 분기의 외국 행동도 함께 기록됩니다.</p>${entries.length?entries.map(entry=>`<article class="history-entry"><span class="eyebrow">${entry.turn}분기 · ${escape(entry.eventTitle)}</span><h3>${escape(entry.actionLabel)}</h3><p>${escape(entry.headline)}</p>${(entry.worldActions??[]).slice(0,4).map(action=>`<p>${escape(COUNTRIES[action.countryId]?.name??'국제사회')}: ${escape(action.text)}</p>`).join('')}</article>`).join(''):'<p>첫 결정을 내리면 기록이 시작됩니다.</p>'}`;
}

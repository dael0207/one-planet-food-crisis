import {nationalProjects,siteProjects} from './project-state.mjs?v=30';
import {activeTreaties} from './treaties.mjs?v=30';
import {renderTreatyResults} from './treaty-ui.mjs?v=30';
import {COUNTRIES,PROFILES,getAction} from './engine.mjs?v=30';
import {getScenario} from './scenarios.mjs?v=30';
import {escape,signed} from './render.mjs?v=30';
import {pendingRequests} from './diplomacy-ui.mjs?v=30';
import {renderNegotiationResult} from './negotiation-ui.mjs?v=30';
import {renderOrders} from './orders-ui.mjs?v=30';
import {renderSiteResults} from './site-ui.mjs?v=30';
import {renderForeignSiteResults} from './foreign-sites-ui.mjs?v=30';
import {renderJointResults} from './joint-investments-ui.mjs?v=30';
import {renderDevelopment} from './development-ui.mjs?v=30';
import {renderObjectiveAchievements} from './objectives-ui.mjs?v=30';
import {renderGoalConsequences} from './world-goals-ui.mjs?v=30';
import {renderConflictResults} from './conflict-ui.mjs?v=30';
import {quarterDate} from './calendar.mjs?v=30';
import {renderResultCauses} from './result-causes.mjs?v=30';
import {renderCabinetFollowthrough} from './cabinet-ui.mjs?v=30';
import {renderStrategyResults} from './foreign-strategy-ui.mjs?v=30';
import {renderFarmResult} from './farm-landscape-ui.mjs?v=30';
const metrics=[['food','식량 안정'],['price','생활물가'],['treasury','국고'],['trust','외교 신뢰']];
export function renderPhase(state,flow){
 const date=quarterDate(flow.phase==='decision'?state.turn:state.turn-1),calendar=`${date.year}년 ${date.quarter}분기`;
 const label=flow.phase==='decision'?`${calendar} · 국내 현안과 외교 전문을 검토하세요`:`${calendar} 결과 · ${['내 나라의 변화','스스로 움직인 세계','협정과 외교 소식','전체 결과 정리'][flow.step]}`;
 return `<div class="phase-label"><span class="status-dot"></span>${label}</div><div class="phase-steps"><span class="${flow.phase==='decision'?'current':''}">01 사건과 선택</span><i>→</i><span class="${flow.phase==='result'?'current':''}">02 변화 확인</span><i>→</i><span>03 다음 분기</span></div>`;
}
export function renderOngoing(state){
 const project=nationalProjects(state)[0],profile=PROFILES[state.playerId];
 return `<div><span class="ongoing-label">국가 운영 기조</span><strong>${state.activePolicy==='embargo'?'식량 수출 제한':state.activePolicy==='resilience'?'기후 회복 사업 · 계절 피해 완화':escape(profile.policyLabel)}</strong><small>${escape(COUNTRIES[state.playerId].name)} · ${escape(COUNTRIES[state.playerId].roleLabel)}</small></div><div><span class="ongoing-label">시설과 협정</span><strong>${escape(profile.facilityName)} · ${project?`${project.dueTurn-state.turn}분기 뒤 완공`:`${state.farmLevel}단계`}</strong><small>진행 중인 국제 협정 ${state.agreements.filter(a=>a.endTurn>state.turn).length+activeTreaties(state).length}건</small></div>`;
}
export function renderDecision(state,selected,requestId=null){
 const event=getScenario(state,requestId),date=quarterDate(state.turn);
 const title=event.agenda?event.title:shortCommandTitle(state,event.title,requestId);
 return `<section class="command-console"${event.agenda?` data-agenda-family="${escape(event.agenda.family)}"`:""} aria-labelledby="decision-title"><div class="dispatch-heading"><span class="console-step" data-stage="choice">01 · 명령 선택</span><strong data-calendar-year="${date.year}" data-calendar-quarter="${date.quarter}">${date.year}년 ${date.quarter}분기 · ${requestId?'외교 회신':'국가 명령'}</strong></div><h2 id="decision-title" tabindex="-1">${headingMarkup(title)}</h2><p class="decision-brief">${event.agenda?'<span class="agenda-origin">발생 배경</span> ':''}${escape(event.description)}</p>${requestId?'<button class="text-button" data-action="domestic">국내 현안으로 돌아가기</button>':''}<details class="decision-context"${requestId?' open':''}><summary>${requestId?'기한과 추가 조건':'배경과 시점'}</summary>${title!==event.title?`<p>${escape(event.title)}</p>`:''}<p>${escape(event.context)}</p></details>${requestId?'':renderCabinetFollowthrough(state,'decision')}<form id="policy-form"><fieldset><legend>${requestId?'회신 명령':'명령 선택 · 효과와 대가'}</legend>${renderOrders(state,event.options,selected,!requestId)}</fieldset><div class="selected-forecast" id="forecast" aria-live="polite">명령을 선택하면 정확한 예상치를 표시합니다.</div><button class="primary-button" type="submit" id="advance-button" disabled>명령 선택 · 1분기 실행 <span aria-hidden="true">→</span></button></form></section>`;
}
function shortCommandTitle(state,title,requestId){
 if(requestId||title.length<18)return title;
 if(state.countries[state.playerId].food<38)return '식량 비축 대응';
 if(nationalProjects(state).length)return `${PROFILES[state.playerId].facilityName} 완공 준비`;
 if(siteProjects(state).length)return '현장 시설 완공 준비';
 return title;
}
function headingMarkup(title){
 return String(title).split(/(국제 항만|지역 농경지|도시 생활권|공동 투자)/).map(part=>/^(국제 항만|지역 농경지|도시 생활권|공동 투자)$/.test(part)?`<span class="heading-unit">${escape(part)}</span>`:escape(part)).join('');
}
function changeRows(state,id){
 const before=state.history.at(-1).beforeCountries[id];
 return metrics.map(([key,label])=>{
  const after=state.countries[id][key];
  const delta=after-before[key];
  const good=key==='price'?delta<0:delta>0;
  return `<div class="change-row" data-metric="${key}"><span>${label}</span><span class="before-value">${before[key]}</span><span class="change-arrow">→</span><b>${after}</b><strong class="change-delta ${delta?(good?'positive':'negative'):''}">${signed(delta)}</strong></div>`;
 }).join('');
}
function foodAccounting(last){
 return `<div class="food-accounting"><h3>식량은 왜 이렇게 변했나요?</h3>${last.foodBreakdown.map(part=>`<div><span>${escape(part.label)}</span><b class="${part.value>0?'positive':part.value<0?'negative':''}">${signed(part.value)}</b></div>`).join('')}<div class="accounting-total"><span>실제 식량 안정 변화</span><b>${signed(last.foodBreakdown.reduce((sum,part)=>sum+part.value,0))}</b></div></div>`;
}
function policyComparison(last){
 const effect=last.policyEffect;
 const parts=metrics.filter(([key])=>effect[key]!==0).map(([key,label])=>`${label} ${signed(effect[key])}`);
 const relations=(last.policyRelationEffects??[]).map(item=>`<span data-policy-relation="${item.countryId}" data-before="${item.before}" data-after="${item.after}" data-delta="${item.effect}">${escape(COUNTRIES[item.countryId].name)} 관계 ${item.before} → ${item.after} <b>유지 대비 ${signed(item.effect)}</b></span>`).join('');
 return `<section class="policy-comparison" data-comparison="maintain" aria-label="기존 정책 유지와 비교"><div class="order-effect"><span>내 명령이 만든 차이 · 유지 대비</span><strong>${escape(parts.join(' · ')||'직접 수치 변화 없음')}</strong></div>${relations?`<div class="policy-relation-effects">${relations}</div>`:''}</section>`;
}
function countryHero(state,id){
 return `<section class="quarterly-delta-strip" aria-label="${escape(COUNTRIES[id].name)} · 이번 분기 최종 식량"><span>분기 최종 지표</span><small class="result-total-note">기후·생산·소비·교역을 모두 합친 변화</small><div class="change-table">${changeRows(state,id)}</div></section>`;
}
function resultTotals(state,last){
 const before=last.beforeCountries[state.playerId],after=state.countries[state.playerId];
 const foodDelta=after.food-before.food,treasuryDelta=after.treasury-before.treasury;
 return `<section class="result-totals" aria-label="이번 분기 최종 보유량"><p>기후·생산·소비·교역을 모두 합친 실제 변화</p><div class="result-total-grid"><div class="result-total" data-metric="food" data-before="${before.food}" data-after="${after.food}" data-delta="${foodDelta}"><span>식량</span><b>${before.food}</b><i aria-hidden="true">→</i><strong>${after.food}</strong><small>${signed(foodDelta)}</small></div><div class="result-total" data-metric="treasury" data-before="${before.treasury}" data-after="${after.treasury}" data-delta="${treasuryDelta}"><span>국고</span><b>${before.treasury}억</b><i aria-hidden="true">→</i><strong>${after.treasury}억</strong><small>${signed(treasuryDelta)}억</small></div></div></section>`;
}
function visibleTreatyResults(state){
 return renderTreatyResults(state).replace(/(<strong>이행 국가 · [^<]+<\/strong><\/div>)(<p>)/g,'$1<span aria-hidden="true">·</span>$2');
}
function consequenceRows(state,last){
 const relations=(last.policyRelationEffects??[]).map(item=>`<div data-consequence="relation"><span>${escape(COUNTRIES[item.countryId].name)} 관계</span><strong>${item.before} → ${item.after}</strong> <small>유지 대비 ${signed(item.effect)}</small></div>`);
 const treaties=(state.lastTreatyEvents??[]).map(event=>`<div data-consequence="treaty"><span>협정 소식</span><strong>${escape(event.text??'장기 협정의 변화가 기록되었습니다.')}</strong></div>`);
 return [...relations,...treaties].join('');
}
function nextQuarter(state){
 const project=nationalProjects(state)[0];
 const siteCount=siteProjects(state).length;
 const parts=[project?`${PROFILES[state.playerId].facilityName} 완공까지 ${Math.max(0,project.dueTurn-state.turn)}분기`:null,siteCount?`지도 시설 ${siteCount}곳 건설 중`:null].filter(Boolean);
 const projectText=parts.join(' · ')||'진행 중인 국내 건설 없음';
 return `${escape(projectText)} · 회신 대기 ${pendingRequests(state).length}건`;
}
export function renderOutcome(state,_step,_country=state.playerId){
 const last=state.history.at(-1);
 const consequences=consequenceRows(state,last);
 const consequenceSection=consequences?`<section class="quarterly-consequences" aria-labelledby="consequence-title"><h3 id="consequence-title">관계와 협정</h3>${consequences}</section>`:'';
 const achievements=renderObjectiveAchievements(state);
 const primaryOutcomes=`${renderConflictResults(state)}${visibleTreatyResults(state)}${renderNegotiationResult(state)}`;
 const worldEvents=`${renderGoalConsequences(state)}${consequenceSection}`;
 const nextDate=quarterDate(state.turn),date=quarterDate(state.turn-1);
 const investments=`${renderDevelopment(state)}${renderJointResults(state)}${renderSiteResults(state)}${renderForeignSiteResults(state)}`;
 return `<div class="quarterly-report" data-console="result"><div class="dispatch-heading"><span class="console-step" data-stage="result">02 · 결과 확인</span><strong data-calendar-year="${date.year}" data-calendar-quarter="${date.quarter}">${date.year}년 ${date.quarter}분기 마감</strong></div><h2 id="decision-title" tabindex="-1">${headingMarkup(last.actionLabel)}</h2>
 ${renderResultCauses(state)}
 ${renderFarmResult(state)}
 ${renderCabinetFollowthrough(state)}
 ${renderStrategyResults(state)}
 <details class="result-reconciliation"><summary>전체 보유량과 정책 비교</summary>${resultTotals(state,last)}${policyComparison(last)}</details>
 ${achievements}${investments?`<details class="result-investment-details"><summary>투자·시설 운영 내역</summary>${investments}</details>`:''}
 ${primaryOutcomes?`<section class="result-primary-outcomes" aria-label="이번 분기 주요 외교 결과">${primaryOutcomes}</section>`:''}
 <div class="result-continuation-rail" data-next-year="${nextDate.year}" data-next-quarter="${nextDate.quarter}"><div class="next-consequence"><strong>${nextDate.year}년 · ${nextDate.quarter}분기 현안</strong><p>${nextQuarter(state)}</p><small>현안을 여는 동안 시간은 흐르지 않습니다. 명령 실행 시 한 분기가 진행됩니다.</small></div><div class="result-continue"><button class="primary-button" data-action="next-quarter">${nextDate.year}년 ${nextDate.quarter}분기 현안 열기 <span aria-hidden="true">→</span></button></div></div>
 ${worldEvents?`<details class="result-events"><summary>세계 사건과 협정 변화</summary>${worldEvents}</details>`:''}<details class="result-ledger"><summary>분기 전체 지표</summary>${countryHero(state,state.playerId)}</details><details class="result-details"><summary class="calculation-question">식량은 왜 변했나요?</summary>${foodAccounting(last)}</details><div class="result-record-links"><button class="text-button" data-action="show-view" data-view="diplomacy">외교 전문</button><button class="text-button" data-action="show-view" data-view="world">세계 상세</button><button class="text-button" data-action="show-view" data-view="records">운영 기록</button></div></div>`;
}

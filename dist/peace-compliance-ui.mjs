import {COUNTRIES} from './country-data.mjs?v=31';
import {peaceCompliancePreview} from './peace-compliance.mjs?v=31';
import {peaceResponseCountryLabel} from './peace-response-model.mjs?v=31';
import {peaceResponseEvents,renderPeaceResponseBrief,renderPeaceResponseResults,renderPeaceResponseReview,renderPeaceResponseWorld} from './peace-response-ui.mjs?v=31';
import {escape} from './render.mjs?v=31';

const STATUS={monitoring:'감시 중',violated:'합의 위반',sanctioned:'재제재 중',renegotiating:'재협상 회신 대기',completed:'감시 종료',replaced:'수정 합의로 대체'};
const EVENT={accord_registered:'합의 감시 시작',accord_fulfilled:'약속 이행',accord_breached:'합의 위반',accord_sanctioned:'재제재 실행',accord_restriction_expired:'교역 제한 종료',accord_completed:'합의 감시 종료',accord_replaced:'수정 합의로 대체',accord_renegotiation_accepted:'수정안 합의',accord_renegotiation_countered:'수정안 역제안',accord_renegotiation_rejected:'수정안 거절'};
const name=id=>COUNTRIES[id]?.name??id;
const accordById=(state,id)=>(state.peaceAccords??[]).find(item=>item.id===id)??null;
const names=ids=>(ids??[]).map(name).join(' · ');
const accordLabel=(state,id)=>{const accord=accordById(state,id);return accord?`${names(accord.principalIds)} · ${accord.createdTurn}분기 합의`:'이전 합의';};
const relationLine=(item,a,b)=>`${name(a)}–${name(b)} 관계 ${item.before} → ${item.after} (${item.delta>0?'+':''}${item.delta})`;
const actionPending=(state,accord)=>accord.status==='violated'&&!accord.response&&state.turn+1<accord.violation.untilTurn;

function monitoringHorizon(state,accord,phase){
 if(accord.status==='monitoring'){
  const next=Math.max(accord.startTurn,phase==='decision'?state.turn+1:state.turn);
  return next<accord.endTurn?`${next}분기 ${phase==='decision'?'다음 점검':'점검'} · ${accord.endTurn-next}회 남음`:'감시 종료';
 }
 const until=accord.response?.kind==='sanction'?accord.response.untilTurn:accord.violation?.untilTurn;
 if(['violated','sanctioned','renegotiating'].includes(accord.status)&&until){
  const execution=phase==='decision'?state.turn+1:state.turn,remaining=Math.max(0,until-execution);
  const starts=accord.response?.kind==='sanction'?accord.response.turn:(accord.violation.startsTurn??accord.violation.turn+1);
  if(execution<starts)return `${starts}분기부터 ${until-1}분기까지 · 총 ${until-starts}회`;
  if(phase==='decision'&&execution===starts)return `${starts}분기부터 ${until-1}분기까지 · 다음 명령부터 ${remaining}회`;
  if(!remaining)return phase==='decision'?'다음 명령부터 제한 종료':'이번 분기로 제한 종료';
  return `${until-1}분기까지 · ${phase==='decision'?'다음 명령부터':'이번 분기 포함'} ${remaining}회`;
 }
 return accord.status==='replaced'?'수정 합의로 이어짐':'점검·거래 제한 종료 · 관계 변화는 유지';
}

function termsLine(terms={}){
 const goal=terms.goal==='peace'?'분쟁 완전 종결':'교역 제재 완화',condition=terms.condition==='target'?'대응국 단독 양보':'양측 상호 양보';
 return `${goal} · ${condition} · 식량 ${terms.food} · 국고 ${terms.money}`;
}

function checks(accord){
 if(!accord.checks.length)return '<p class="peace-compliance-empty">아직 실행된 점검이 없습니다. 서명 다음 명령부터 실제 행동을 확인합니다.</p>';
 return `<ol class="peace-compliance-checks">${accord.checks.toReversed().map(check=>`<li data-compliance-check="${escape(check.status)}"><header><strong>${check.status==='fulfilled'?'양측 이행':'위반 확인'}</strong><span>${check.turn}분기</span></header>${check.results.map(result=>`<div><b>${escape(name(result.countryId))} · ${result.status==='fulfilled'?'약속 이행':'약속 위반'}</b><p>${escape(result.reason)}</p><small>상대국 관계 ${result.relationBefore} → ${result.relationAfter} · 약속 신뢰 ${result.reliabilityBefore} → ${result.reliabilityAfter}</small></div>`).join('')}</li>`).join('')}</ol>`;
}

function eventFacts(state,event,accord){
 const violator=accord?.violation?.countryId??event.targetId;
 const relations=(event.relationChanges??[]).map(item=>`<li>${escape(relationLine(item,state.playerId,item.countryId))}</li>`).join('');
 const observers=(event.observerChanges??[]).map(item=>`<li>${escape(relationLine(item,item.countryId,violator))}</li>`).join('');
 const actor=Number.isFinite(event.relationBefore)&&Number.isFinite(event.reliabilityBefore)?`<p>${escape(name(event.countryId))} · 상대국 관계 ${event.relationBefore} → ${event.relationAfter} · 약속 신뢰 ${event.reliabilityBefore} → ${event.reliabilityAfter}</p>`:'';
 return `${actor}${relations?`<ul class="peace-compliance-facts">${relations}</ul>`:''}${observers?`<details><summary>제3국의 실제 반응</summary><ul class="peace-compliance-facts">${observers}</ul></details>`:''}`;
}

export function pendingPeaceComplianceCount(state){return (state.peaceAccords??[]).filter(accord=>actionPending(state,accord)).length;}

export function renderPeaceComplianceBrief(state,phase='decision'){
 const accords=state.peaceAccords??[];if(!accords.length)return '';
 const latest=[...accords].toReversed(),accord=latest.find(item=>['active','proposed'].includes(item.foreignResponse?.status))??latest.find(item=>['violated','sanctioned','renegotiating','monitoring'].includes(item.status))??accords.at(-1);
 if(accord.foreignResponse?.status==='proposed')return '';
 const foreign=renderPeaceResponseBrief(state,accord,phase);if(foreign)return foreign;
 const violation=accord.violation?`${name(accord.violation.countryId)} 위반 · ${accord.violation.reason}`:`${names(accord.principalIds)} · ${STATUS[accord.status]??accord.status}`;
 return `<section class="peace-compliance-brief" data-peace-accord-brief aria-label="평화 합의 이행 감시"><div><span>평화 합의 감시 · ${accords.length}건</span><strong>${escape(violation)}</strong><p>${escape(monitoringHorizon(state,accord,phase))}</p></div><button type="button" class="secondary-button" data-action="review-peace-accord" data-id="${escape(accord.id)}" ${phase==='decision'?'':'disabled'}>${phase==='decision'?'이행 기록 검토 →':'결과 확인 후 검토'}</button></section>`;
}

export function renderPeaceAccordReview(state,id){
 const accord=accordById(state,id);if(!accord)return '<h2 id="decision-title" tabindex="-1">합의 기록을 찾을 수 없습니다</h2><button class="secondary-button" data-action="domestic">국내 현안으로 돌아가기</button>';
 const events=accord.events??[],latest=events.toReversed().find(item=>(item.relationChanges?.length??0)||(item.observerChanges?.length??0));
 const canRespond=actionPending(state,accord),sanction=canRespond?peaceCompliancePreview(state,id,'sanction'):null;
 const checkHorizon=accord.status==='monitoring'?` · ${monitoringHorizon(state,accord,'decision')}`:'';
 const revision=`${accord.revisionOf?`<div><dt>대체한 원래 합의</dt><dd>${escape(accordLabel(state,accord.revisionOf))}</dd></div>`:''}`;
 const violation=accord.violation?`<div><dt>위반 교역 제한</dt><dd>${escape(name(accord.violation.countryId))} · ${escape(accord.violation.reason)} · ${escape(monitoringHorizon(state,accord,'decision'))}</dd></div>`:'';
 const actions=canRespond?`<section class="peace-compliance-actions" aria-label="위반 합의 대응"><h3>우리의 대응은 자동으로 정해지지 않습니다</h3><p>기존 위반에 따른 교역 제한과 관계 손실은 기록되어 있습니다. 아래 대응은 각각 별도의 한 분기 명령입니다.</p><button type="button" class="secondary-button" data-action="review-peace-sanction" data-id="${escape(accord.id)}" ${sanction?'':'disabled'}>재제재 영향 검토</button><button type="button" class="secondary-button" data-action="renegotiate-peace-accord" data-id="${escape(accord.id)}">새 조건으로 재협상</button></section>`:'';
 const replaced=accord.replacedById?`<p class="peace-compliance-replaced">이 원래 합의는 <button type="button" class="text-button" data-action="review-peace-accord" data-id="${escape(accord.replacedById)}">${escape(accordLabel(state,accord.replacedById))} 수정 합의 보기</button>로 대체됐습니다.</p>`:'';
 return `<div class="peace-compliance-review" data-accord-id="${escape(accord.id)}"><div class="decision-kicker"><span>평화 합의 이행부</span><span>${escape(STATUS[accord.status]??accord.status)}</span></div><h2 id="decision-title" tabindex="-1">${escape(names(accord.principalIds))}의 약속</h2><p class="event-description">${escape(accord.obligation)}</p><button type="button" class="text-button" data-action="domestic">국내 현안으로 돌아가기 ↗</button><dl class="peace-compliance-summary"><div><dt>${accord.revisionOf?'수정 합의':'합의 원안'}</dt><dd>${escape(termsLine(accord.terms))}</dd></div>${revision}<div><dt>합의 점검</dt><dd>${accord.startTurn}분기부터 ${accord.endTurn-1}분기까지${escape(checkHorizon)}</dd></div>${violation}</dl>${renderPeaceResponseReview(state,accord)}<section class="peace-compliance-ledger"><h3>국가별 점검 기록</h3>${checks(accord)}</section>${latest?`<details class="peace-compliance-impact"><summary>실제 관계·신뢰·제3국 영향</summary>${eventFacts(state,latest,accord)}</details>`:''}${actions}${replaced}</div>`;
}

export function renderPeaceSanctionReview(state,id){
 const accord=accordById(state,id),preview=peaceCompliancePreview(state,id,'sanction');
 if(!accord||!preview)return '<h2 id="decision-title" tabindex="-1">지금 재제재할 수 없습니다</h2><p class="event-description">이미 대응했거나 교역 제한 기한이 끝났습니다.</p><button class="secondary-button" data-action="review-peace-accord" data-id="'+escape(id)+'">합의 기록으로 돌아가기</button>';
 return `<div class="peace-compliance-review" data-accord-id="${escape(id)}"><div class="decision-kicker"><span>합의 위반 대응</span><span>1분기 명령</span></div><h2 id="decision-title" tabindex="-1">${escape(name(preview.violatorId))} 재제재 검토</h2><p class="event-description">${escape(preview.description)}</p><button type="button" class="text-button" data-action="review-peace-accord" data-id="${escape(id)}">합의 기록으로 돌아가기 ↗</button><dl class="peace-compliance-summary"><div><dt>실제 교역 차단</dt><dd>${escape(names(preview.restrictedIds))}</dd></div><div><dt>실행 기간</dt><dd>${preview.startsTurn}분기부터 ${preview.untilTurn-1}분기까지 · 총 ${preview.quarters}회</dd></div><div><dt>직접 자원 비용</dt><dd>식량 ${preview.costs.food} · 국고 ${preview.costs.money}</dd></div></dl><ul class="peace-compliance-facts">${preview.relationChanges.map(item=>`<li>${escape(relationLine(item,state.playerId,item.countryId))}</li>`).join('')}</ul>${preview.observerChanges.length?`<details><summary>제3국의 예상 반응</summary><ul class="peace-compliance-facts">${preview.observerChanges.map(item=>`<li>${escape(relationLine(item,item.countryId,preview.violatorId))}</li>`).join('')}</ul></details>`:''}<p class="selected-forecast" role="status">${escape(preview.forecast)}</p><form id="peace-sanction-form"><button class="primary-button" id="confirm-peace-sanction" type="submit">재제재하고 한 분기 진행 <span aria-hidden="true">→</span></button></form><p class="decision-note">재제재는 반복할 수 없으며, 인도적 지원은 상업 교역 제한에서 제외됩니다.</p></div>`;
}

export function renderPeaceComplianceResults(state){
 const foreign=renderPeaceResponseResults(state),foreignEvents=new Set(peaceResponseEvents(state)),events=(state.lastPeaceComplianceEvents??[]).filter(event=>!foreignEvents.has(event));if(!events.length)return foreign;
 return `${foreign}<section class="peace-compliance-results" aria-labelledby="peace-compliance-result-title"><span>평화 합의 이행 결과</span><h3 id="peace-compliance-result-title">약속과 실제 행동</h3>${events.map(event=>{const accord=accordById(state,event.accordId);return `<article data-peace-compliance-event="${escape(event.type)}"><header><strong>${escape(EVENT[event.type]??event.type)}</strong><span>${event.turn}분기</span></header><p>${escape(event.text)}</p>${event.costs&&(event.costs.food||event.costs.money)?`<p class="mediation-paid">실제 이행 · 식량 ${event.costs.food}, 국고 ${event.costs.money}</p>`:''}${event.untilTurn?`<p>실제 효과 · ${event.untilTurn-1}분기까지</p>`:''}${eventFacts(state,event,accord)}</article>`;}).join('')}<small>위 항목은 합의 이행과 대응의 직접 결과입니다. 분기 최종 지표에는 생산·소비·기후·모든 교역이 함께 반영됩니다.</small></section>`;
}

export function renderPeaceComplianceWorld(state,phase='decision'){
 const accords=state.peaceAccords??[];if(!accords.length)return '';
 return `<section class="peace-compliance-world"><h3>평화 합의 이행 기록</h3>${accords.toReversed().map(accord=>`<article data-accord-id="${escape(accord.id)}"><header><strong>${escape(names(accord.principalIds))} · ${accord.revisionOf?'수정 합의':'원래 합의'}</strong><span>${escape(STATUS[accord.status]??accord.status)}</span></header><p>${escape(accord.obligation)}</p>${accord.revisionOf?`<p>${escape(accordLabel(state,accord.revisionOf))}를 대체해 새 점검을 시작했습니다.</p>`:''}<small>${accord.startTurn}–${accord.endTurn-1}분기 감시 · 이행 ${accord.checks.filter(item=>item.status==='fulfilled').length}회 · 위반 ${accord.checks.filter(item=>item.status==='breached').length}회</small>${accord.violation?`<p>${escape(name(accord.violation.countryId))} 위반 · ${escape(accord.violation.reason)}</p>`:''}${renderPeaceResponseWorld(state,accord)}<details><summary>점검과 대응 전체 기록</summary>${checks(accord)}${accord.events.length?`<ul class="peace-compliance-events">${accord.events.map(event=>`<li>${event.turn}분기 · ${escape(EVENT[event.type]??event.type)} · ${escape(event.text)}</li>`).join('')}</ul>`:''}</details><button type="button" class="secondary-button" data-action="review-peace-accord" data-id="${escape(accord.id)}" ${phase==='decision'?'':'disabled'}>${phase==='decision'?'합의 검토':'결과 확인 후 검토'}</button></article>`).join('')}</section>`;
}

export function peaceComplianceCountryLabel(state,id){
 const foreign=peaceResponseCountryLabel(state,id)??'';
 const accord=(state.peaceAccords??[]).find(item=>{const starts=item.response?.kind==='sanction'?item.response.turn:(item.violation?.startsTurn??item.violation?.turn+1),until=item.response?.kind==='sanction'?item.response.untilTurn:item.violation?.untilTurn;return item.violation?.countryId===id&&state.turn>=starts&&state.turn<until&&['violated','sanctioned','renegotiating'].includes(item.status);});
 const compliance=accord?'합의 위반 · 교역 제한':'';return foreign+(foreign&&compliance?' · ':'')+compliance;
}

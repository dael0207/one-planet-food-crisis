import {COUNTRIES} from './country-data.mjs?v=31';
import {activeConflicts,conflictAction} from './goal-conflicts.mjs?v=31';
import {previewMediation,reliefActive} from './mediation.mjs?v=31';
import {defaultMediationDraft,renderMediationCounters,renderMediationResults} from './mediation-ui.mjs?v=31';
import {renderPeaceOfferBrief,renderPeaceOfferHistory,renderPeaceOfferResults} from './peace-offer-ui.mjs?v=31';
import {peaceComplianceCountryLabel,renderPeaceComplianceBrief,renderPeaceComplianceResults,renderPeaceComplianceWorld} from './peace-compliance-ui.mjs?v=31';
import {escape} from './render.mjs?v=31';

const names=ids=>(ids??[]).map(id=>COUNTRIES[id]?.name??id).join(' · ');
const STANCES={sanction:'제재 동참',response:'공동 대응 참여',neutral:'중립 선언'};
const stanceLabel=conflict=>STANCES[conflict.playerStance]??'입장 미정';
const remaining=(state,conflict)=>Math.max(0,conflict.endTurn-Math.max(state.turn+1,conflict.startTurn));
const horizon=(state,conflict,phase)=>{
 const execution=phase==='decision'?state.turn+1:state.turn;
 if(reliefActive({...state,turn:execution},conflict))return `교역 휴전 ${conflict.ceasefireUntil-execution}분기 · ${phase==='decision'?'다음 명령부터':'이번 분기 포함'}`;
 if(phase==='decision'&&reliefActive(state,conflict))return execution<conflict.endTurn?'다음 명령부터 제재 재개':'다음 명령부터 분쟁 종료';
 return remaining(state,conflict)?'앞으로 '+remaining(state,conflict)+'분기':'이번 분기로 종료';
};
const title=conflict=>`${COUNTRIES[conflict.initiatorId]?.name??'제재국'} · ${COUNTRIES[conflict.targetId]?.name??'대응국'} 무역 분쟁`;
const choices=(state,conflict)=>Object.keys(STANCES).map(stance=>conflictAction(state,`stance:${conflict.id}:${stance}`)).filter(Boolean);
const visibleConflict=state=>activeConflicts(state).find(item=>!item.peaceComplianceAccordId);

function sides(conflict){
 return `<dl class="conflict-sides"><div><dt>제재 연합</dt><dd>${escape(names(conflict.sanctionMembers))}</dd></div><div><dt>공동 대응</dt><dd>${escape(names(conflict.responseMembers))}</dd></div></dl>`;
}

export function renderConflictBrief(state,phase='decision'){
 const compliance=renderPeaceComplianceBrief(state,phase),incoming=renderPeaceOfferBrief(state,phase),conflict=visibleConflict(state);if(!conflict)return compliance+incoming+renderMediationCounters(state,phase);
 const canChoose=choices(state,conflict).length>0,canMediate=Boolean(previewMediation(state,defaultMediationDraft(conflict.id)));
 return `${compliance}${incoming}<section class="conflict-brief" aria-label="진행 중인 무역 분쟁"><div><span>무역 분쟁 · ${horizon(state,conflict,phase)}</span><strong>${escape(title(conflict))}</strong><p>${escape(names(conflict.sanctionMembers))} ⇄ ${escape(names(conflict.responseMembers))}</p></div><div><b>${escape(stanceLabel(conflict))}</b><div class="conflict-actions">${canChoose?`<button type="button" class="secondary-button" data-action="review-conflict" data-id="${escape(conflict.id)}" ${phase==='decision'?'':'disabled'}>${phase==='decision'?'우리 입장 검토':'다음 분기에 입장 선택'}</button>`:''}${canMediate?`<button type="button" class="secondary-button" data-action="open-mediation" data-id="${escape(conflict.id)}" ${phase==='decision'?'':'disabled'}>${phase==='decision'?'평화 협상 →':'결과 확인 후 협상'}</button>`:''}${!canChoose&&!canMediate?'<button type="button" class="text-button" data-action="show-view" data-view="world">분쟁 상세 ↗</button>':''}</div></div></section>${renderMediationCounters(state,phase)}`;
}

export function renderConflictReview(state,id,selected=null){
 const phase='decision';
 const conflict=activeConflicts(state).find(item=>item.id===id);
 if(!conflict)return '<h2 id="decision-title" tabindex="-1">분쟁이 종료되었습니다</h2><button class="text-button" data-action="domestic">국내 현안으로 돌아가기</button>';
 const afterRelief=conflict.ceasefireUntil<conflict.endTurn?`${conflict.ceasefireUntil}분기부터 남은 제재와 분담이 재개됩니다.`:'휴전 종료와 함께 분쟁도 끝나며 추가 제재와 분담은 없습니다.';
 const options=choices(state,conflict),restriction=reliefActive({...state,turn:state.turn+1},conflict)?`교역 휴전으로 이번 명령의 교역 제한과 진영 분담은 멈춥니다. ${afterRelief}`:'제재 연합과 공동 대응국 사이의 식량 무역이 중단됩니다. 인도적 지원은 유지됩니다.';
 return `<div class="conflict-review"><div class="dispatch-heading"><span>외교 명령 · ${horizon(state,conflict,phase)}</span></div><h2 id="decision-title" tabindex="-1">어느 편에 설 것인가</h2><p class="event-description">${escape(title(conflict))}. ${escape(conflict.reason)}</p>${sides(conflict)}<p class="conflict-rule">${escape(restriction)}</p><button type="button" class="text-button" data-action="domestic">국내 현안으로 돌아가기</button><form id="conflict-form"><fieldset><legend>우리 나라의 입장 · 선택 후 실행</legend>${options.map(action=>`<label class="policy${selected===action.id?' selected':''}"><input type="radio" name="conflict-stance" value="${escape(action.id)}" ${selected===action.id?'checked':''}><span class="policy-copy"><span class="policy-title"><strong>${escape(action.name)}</strong><small>1분기 결정</small></span><p>${escape(action.description)}</p><span class="conflict-choice-terms">${escape(action.forecast)}</span></span></label>`).join('')}</fieldset><p class="conflict-rule">입장은 분쟁이 끝날 때까지 유지됩니다. 종료되면 제재와 공동 대응은 멈추고, 바뀐 국가 관계는 남습니다.</p><div class="selected-forecast" id="forecast" aria-live="polite">입장을 선택하세요. 검토 중에는 시간이 흐르지 않습니다.</div><button type="submit" class="primary-button" id="advance-button" disabled>입장을 선택하세요 <span aria-hidden="true">→</span></button></form></div>`;
}

export function renderConflictResults(state){
 const phase='result';
 const events=(state.lastConflictEvents??[]).filter(event=>!String(event.type).startsWith('mediation_')),conflict=visibleConflict(state);
 const peace=renderPeaceOfferResults(state),mediation=renderMediationResults(state),compliance=renderPeaceComplianceResults(state);if(!events.length&&!conflict)return compliance+peace+mediation;
 const rows=events.map(event=>`<li data-conflict-event="${escape(event.type)}">${escape(event.text)}</li>`).join('');
 return `${compliance}${peace}${mediation}<section class="conflict-report" aria-labelledby="conflict-report-title"><span>국경 너머에 남는 결정</span><h3 id="conflict-report-title">제재와 공동 대응</h3>${conflict?`<p><strong>${escape(stanceLabel(conflict))}</strong> · ${horizon(state,conflict,phase)}</p>${conflict.commitment?`<p class="conflict-rule">${reliefActive(state,conflict)?(conflict.ceasefireUntil<conflict.endTurn?'중재 휴전 동안 교역 제한과 정기 분담이 멈춥니다. 휴전이 끝나면 남은 제재 기간이 이어집니다.':'휴전 동안 교역 제한과 정기 분담이 멈추고, 휴전 종료와 함께 분쟁도 끝납니다.'):remaining(state,conflict)?escape(conflict.commitment.recurringText):'다음 분기부터 교역 제한과 정기 분담이 해제됩니다.'}</p>`:''}`:''}${rows?`<ul>${rows}</ul>`:''}${conflict&&!conflict.playerStance&&choices(state,conflict).length?'<p class="conflict-rule">우리 입장은 아직 미정입니다. 다음 분기에 지지 또는 중립을 선택할 수 있습니다.</p>':''}</section>`;
}

export function renderConflictWorld(state,phase='decision'){
 const conflicts=(state.goalConflicts??[]).filter(item=>!item.peaceComplianceAccordId),history=renderPeaceOfferHistory(state),compliance=renderPeaceComplianceWorld(state,phase);if(!conflicts.length)return compliance+history+renderMediationCounters(state,phase);
 return `${compliance}${history}<section class="conflict-world"><h3>무역 분쟁과 공동 대응</h3>${conflicts.slice(-4).toReversed().map(conflict=>{const live=conflict.status==='active'&&state.turn<conflict.endTurn,canMediate=live&&Boolean(previewMediation(state,defaultMediationDraft(conflict.id))),status=live?horizon(state,conflict,phase):conflict.status==='resolved'?'중재 합의로 종결':'기간 종료';return `<article><header><strong>${escape(title(conflict))}</strong><span>${escape(status)}</span></header><p>${escape(conflict.reason)}</p>${sides(conflict)}<p>우리 입장 · ${escape(stanceLabel(conflict))}</p><div class="conflict-actions">${live&&choices(state,conflict).length?`<button class="secondary-button" data-action="review-conflict" data-id="${escape(conflict.id)}" ${phase==='decision'?'':'disabled'}>우리 입장 검토</button>`:''}${canMediate?`<button class="secondary-button" data-action="open-mediation" data-id="${escape(conflict.id)}" ${phase==='decision'?'':'disabled'}>평화 협상 →</button>`:''}</div><small>${conflict.startTurn}분기부터 ${conflict.endTurn-1}분기까지${conflict.extraQuarters?` · 협상 결렬로 ${conflict.extraQuarters}분기 연장`:''} · 관계 변화는 종료 후에도 남습니다.</small></article>`;}).join('')}${renderMediationCounters(state,phase)}</section>`;
}

export function conflictCountryLabel(state,id){
 const compliance=peaceComplianceCountryLabel(state,id),conflict=visibleConflict(state);if(!conflict)return compliance;
 const pause=reliefActive(state,conflict)?' · 교역 휴전':'';
 if(conflict.sanctionMembers.includes(id))return '제재 연합'+pause+(compliance?' · '+compliance:'');
 if(conflict.responseMembers.includes(id))return '공동 대응'+pause+(compliance?' · '+compliance:'');
 const neutral=id===state.playerId&&conflict.playerStance==='neutral'?'중립':'';
 return neutral+(neutral&&compliance?' · ':'')+compliance;
}

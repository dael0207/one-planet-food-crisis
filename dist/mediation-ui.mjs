import {COUNTRIES} from './country-data.mjs?v=30';
import {mediationAction,mediationCommand,pendingMediationCounters,previewMediation} from './mediation.mjs?v=30';
import {peaceCounterCommand,peaceOfferAction} from './peace-offers.mjs?v=30';
import {peaceComplianceCommand,peaceCompliancePreview} from './peace-compliance.mjs?v=30';
import {quarterDate} from './calendar.mjs?v=30';
import {escape} from './render.mjs?v=30';
import {renderConsent,renderPeaceChange,renderPeaceLevers} from './mediation-insight.mjs?v=30';

const OUTCOMES={accepted:'합의 가능',countered:'역제안 예상',rejected:'거절 예상',escalated:'갈등 확대 위험'};
const RESULTS={accepted:'합의 성립',countered:'역제안 도착',rejected:'협상 결렬',escalated:'갈등 확대',expired:'회신 기한 종료',cancelled:'분쟁 종료로 회신 취소'};
const GOALS={relief:'최대 2분기 교역 휴전',peace:'분쟁 완전 종결'};
const CONDITIONS={mutual:'양측의 상호 양보',target:'대응국의 단독 양보'};
const name=id=>COUNTRIES[id]?.name??id;
const activeConflict=(state,id)=>state.goalConflicts?.find(item=>item.id===id&&item.status==='active'&&state.turn<item.endTurn)??null;

export function defaultMediationDraft(conflictId){return {conflictId,goal:'relief',condition:'mutual',food:4,money:6};}

export function mediationDraftFromForm(form){
 const data=new FormData(form);
 const draft={conflictId:String(data.get('conflictId')),goal:String(data.get('goal')),condition:String(data.get('condition')),food:Number(data.get('food')),money:Number(data.get('money')),offerId:data.get('offerId'),accordId:data.get('accordId')};
 return draft.accordId?{...draft,accordId:String(draft.accordId)}:draft.offerId?{...draft,offerId:String(draft.offerId)}:draft;
}

const mediationPreview=(state,input)=>input.accordId?peaceCompliancePreview(state,input.accordId,'renegotiate',input)?.mediation:previewMediation(state,input);

function splitText(shares=[]){return shares.map(item=>`${name(item.countryId)} ${item.amount}`).join(' · ')||'이전 없음';}
function resultClass(outcome){return outcome==='accepted'?'accept':outcome==='countered'?'counter':'reject';}
function checked(value,expected){return value===expected?'checked':'';}
function selected(value,expected){return value===expected?'selected':'';}

export function renderMediationTerms(state,input={}){
 const preview=mediationPreview(state,input);
 if(!preview)return '<div class="mediation-terms"><strong>지금 제안할 수 없는 조건입니다.</strong><p>분쟁의 남은 기간과 이번 분기의 이전 제안을 확인하세요.</p></div>';
 const goal=preview.terms.goal==='relief'?`${preview.reliefQuarters}분기 교역 휴전`:GOALS[preview.terms.goal];
 return `<div class="mediation-terms"><div><span>목표</span><strong>${escape(goal)}</strong></div><div><span>요구</span><strong>${escape(CONDITIONS[preview.terms.condition])}</strong></div><div><span>실제 식량 배분</span><strong>${escape(splitText(preview.costs.foodShares))}</strong></div><div><span>실제 재정 배분</span><strong>${escape(splitText(preview.costs.moneyShares))}</strong></div><p>합의될 때만 우리 식량 ${preview.costs.food}, 국고 ${preview.costs.money}이 이동합니다.</p></div>`;
}

export function renderMediationPreview(state,input={},previousDraft=null){
 const preview=mediationPreview(state,input);
 if(!preview)return '<div class="mediation-preview response-reject" role="status"><strong>제안 불가</strong><p>분쟁이 끝나가거나 이번 분기에 이미 중재안을 보냈습니다.</p></div>';
 const previous=previousDraft?.conflictId===input.conflictId?mediationPreview(state,previousDraft):null;
 const payment=preview.outcome==='accepted'?`합의 시 우리 부담 · 식량 ${preview.costs.food} · 국고 ${preview.costs.money}억`:'합의 전에는 지원 자원이 이동하지 않습니다.';
 const player=state.countries[state.playerId],shortfall=preview.outcome==='accepted'&&(player.food<preview.costs.food||player.treasury<preview.costs.money)?`<p class="mediation-shortfall">양국의 동의와 별개로 우리 이행 자원이 부족합니다. 식량 ${player.food} / 필요 ${preview.costs.food} · 국고 ${player.treasury} / 필요 ${preview.costs.money}억</p>`:'';
 return `<div class="mediation-preview response-${resultClass(preview.outcome)}"><div class="mediation-verdict"><span>현재 조건의 예상 결과</span><strong>${escape(OUTCOMES[preview.outcome])}</strong></div><p class="mediation-payment">${payment}</p>${shortfall}${renderPeaceChange(preview,previous)}${renderConsent(preview.reactions,previous)}${preview.counterTerms?`<p class="mediation-counter-hint">예상 역제안 · ${escape(GOALS[preview.counterTerms.goal])}, ${escape(CONDITIONS[preview.counterTerms.condition])}, 식량 ${preview.counterTerms.food}, 국고 ${preview.counterTerms.money}</p>`:''}<small>양국 모두 62점 이상이면 동의합니다. 48–61점은 조건 조정, 그 미만은 거절입니다. 점수는 현재 관계·입장·양보와 지원 몫에 따른 판단이며 확률이 아닙니다.</small>${renderPeaceLevers(input,draft=>mediationPreview(state,draft))}<p class="mediation-announcement sr-only" role="status">${escape(OUTCOMES[preview.outcome])} · ${preview.reactions.map(item=>`${escape(name(item.countryId))} ${item.score}점`).join(' · ')}${previous?' · 직전 조건과 비교가 갱신되었습니다.':''}</p></div>`;
}

export function renderMediationComparison(offer,draft){
 if(!offer)return '';
 const before=offer.terms,changed=['goal','condition','food','money'].filter(key=>before[key]!==draft[key]);
 const line=terms=>`${GOALS[terms.goal]} · ${CONDITIONS[terms.condition]} · 식량 ${terms.food} · 국고 ${terms.money}`;
 const revision=Boolean(draft.accordId);
 const unchanged=revision?'기존 조건으로 재협상합니다. 수락하면 새 이행 점검을 시작합니다.':'원안과 같은 조건입니다. 한 가지 이상 바꿔야 역제안할 수 있습니다.';
 return `<div class="mediation-comparison" id="mediation-comparison" aria-live="polite"><div><span>${revision?'원래 합의':'도착한 원안'}</span><strong>${escape(line(before))}</strong></div><div><span>${revision?'새 수정안':'우리 역제안'}</span><strong>${escape(line(draft))}</strong></div><p>${changed.length?`변경 항목 · ${escape(changed.map(key=>({goal:'목표',condition:'양보 조건',food:'식량',money:'국고'})[key]).join(' · '))}`:unchanged}</p></div>`;
}

export function renderMediationForm(state,input={},previousDraft=null){
 const draft={...defaultMediationDraft(input.conflictId),...input},conflict=activeConflict(state,draft.conflictId),offer=draft.offerId?(state.peaceOffers??[]).find(item=>item.id===draft.offerId):null,accord=draft.accordId?(state.peaceAccords??[]).find(item=>item.id===draft.accordId):null,isCounter=Boolean(offer),isRevision=Boolean(accord),command=isRevision?peaceComplianceCommand(accord.id,'renegotiate',draft):isCounter?peaceCounterCommand(draft):mediationCommand(draft),action=isRevision?peaceCompliancePreview(state,accord.id,'renegotiate',draft):isCounter?peaceOfferAction(state,command):mediationAction(state,command),player=state.countries[state.playerId];
 if(!conflict&&!accord)return '<h2 id="decision-title" tabindex="-1">중재할 분쟁이 없습니다</h2><p class="event-description">분쟁이 이미 끝났거나 중재 회신 기한이 지났습니다.</p><button class="secondary-button" data-action="domestic">국내 현안으로 돌아가기</button>';
 const affordable=Boolean(action&&player.food>=(isRevision?action.costs.food:action.foodCost)&&player.treasury>=(isRevision?action.costs.money:action.cost));
 const principals=accord?.principalIds??[conflict.initiatorId,conflict.targetId],source=offer??accord;
 const date=quarterDate(state.turn),calendar=`${date.year}년 ${date.quarter}분기`;
 const submitLabel=affordable?(isRevision?'수정안을 보내고 한 분기 진행':isCounter?'변경 조건을 역제안하고 한 분기 진행':'이 조건을 제시하고 한 분기 진행'):(isCounter||isRevision)&&!action?'한 가지 이상 조건을 변경하세요':'조건 또는 보유 자원을 확인하세요';
 return `<div class="decision-kicker"><span>${isRevision?'위반 합의 재협상':isCounter?`${escape(name(offer.fromId))} 제안에 역제안`:'평화 협상'}</span><span>${calendar}</span></div><h2 id="decision-title" tabindex="-1">${isRevision?'새 합의 조건을 정하세요':isCounter?'바꿀 조건을 정하세요':'양측에 제시할 중재 조건'}</h2><p class="event-description">${escape(name(principals[0]))} · ${escape(name(principals[1]))} 양국의 반응은 관계와 조건에 따라 달라집니다. 편집하는 동안에는 시간이 흐르지 않습니다.</p><button class="text-button" type="button" data-action="${isRevision?'review-peace-accord':isCounter?'review-peace-offer':'domestic'}" ${(isRevision||isCounter)?`data-id="${escape(source.id)}"`:''}>${isRevision?'원래 합의 검토로 돌아가기 ↗':isCounter?'도착한 원안으로 돌아가기 ↗':'국내 현안으로 돌아가기 ↗'}</button><form id="mediation-form"><input type="hidden" name="conflictId" value="${escape(draft.conflictId)}">${isRevision?`<input type="hidden" name="accordId" value="${escape(accord.id)}">`:isCounter?`<input type="hidden" name="offerId" value="${escape(offer.id)}">`:''}<fieldset class="mediation-goals"><legend>협상 목표</legend>${Object.entries(GOALS).map(([value,label])=>`<label><input type="radio" name="goal" value="${value}" ${checked(draft.goal,value)}><span><strong>${escape(label)}</strong><small>${value==='relief'?'상업 교역 제한과 공동 대응을 잠시 멈춥니다.':'합의 즉시 제재와 공동 대응을 끝냅니다.'}</small></span></label>`).join('')}</fieldset><fieldset class="mediation-goals"><legend>양보 조건</legend>${Object.entries(CONDITIONS).map(([value,label])=>`<label><input type="radio" name="condition" value="${value}" ${checked(draft.condition,value)}><span><strong>${escape(label)}</strong><small>${value==='mutual'?'양측이 함께 물러나는 균형 조건입니다.':'대응국에만 물러날 것을 요구해 갈등 위험이 큽니다.'}</small></span></label>`).join('')}</fieldset><div class="mediation-fields"><label>우리 식량 기여<select name="food">${[0,4,8].map(value=>`<option value="${value}" ${selected(draft.food,value)}>총 ${value}</option>`).join('')}</select></label><label>우리 국고 기여<select name="money">${[0,6,12].map(value=>`<option value="${value}" ${selected(draft.money,value)}>총 ${value}</option>`).join('')}</select></label></div><div id="mediation-preview">${renderMediationPreview(state,draft,previousDraft)}</div><details class="mediation-detail"><summary>원안 비교와 합의 후 배분</summary>${renderMediationComparison(source,draft)}<div id="mediation-terms">${renderMediationTerms(state,draft)}</div></details><p class="peace-offer-resources">현재 보유 · 식량 <strong>${player.food}</strong> · 국고 <strong>${player.treasury}</strong></p><button class="primary-button" type="submit" id="send-mediation" ${affordable?'':'disabled'}>${submitLabel} <span aria-hidden="true">→</span></button></form><p class="decision-note">${isRevision?'수정안 발송은 한 분기 명령입니다. 수락된 경우에만 기존 제한을 풀고 실제 지원을 한 번 지급하며 새 합의 감시를 시작합니다.':isCounter?'역제안 발송은 한 분기 명령이며, 실제 합의 결과와 자원 이동은 현재 국가 반응으로 판정됩니다.':'거절이나 역제안에는 중재 지원 자원이 들지 않습니다. 역제안은 다음 명령으로 수락해야 효력이 생깁니다.'}</p>`;
}

function counterAction(state,record){return mediationAction(state,`mediate-accept:${record.id}`);}
export function renderMediationCounters(state,phase='decision'){
 const records=pendingMediationCounters(state);if(!records.length)return '';
 return `<section class="mediation-counters" aria-label="양측의 중재 역제안"><div><span>중재 회신</span><h3>양측의 역제안 ${records.length}건</h3></div>${records.map(record=>{const terms=record.counterTerms,action=counterAction(state,record),outcome=action?.mediationPreview?.outcome,accepted=outcome==='accepted',affordable=Boolean(accepted&&state.countries[state.playerId].food>=action.foodCost&&state.countries[state.playerId].treasury>=action.cost),label=phase!=='decision'?'결과 확인 후 회신':!action?'회신 기한 또는 분쟁 상태 확인':outcome==='countered'?'추가 조건 조정 필요':outcome==='escalated'?'회신 시 갈등 확대 위험':!accepted?'현재 관계로 합의 불가':!affordable?'합의 이행 자원 부족':'역제안에 회신 · 1분기 진행';return `<article><div><strong>${escape(GOALS[terms.goal])}</strong><span>${record.expiresTurn-state.turn}분기 내 회신</span></div><p>${escape(CONDITIONS[terms.condition])} · 식량 ${terms.food} · 국고 ${terms.money}</p><button type="button" class="secondary-button" data-action="accept-mediation-counter" data-id="${escape(record.id)}" ${phase==='decision'&&affordable?'':'disabled'}>${escape(label)}</button></article>`;}).join('')}</section>`;
}

export function renderMediationResults(state){
 const offerRecordIds=new Set((state.lastPeaceOfferEvents??[]).map(item=>item.reply?.mediationRecordId).filter(Boolean)),events=(state.lastMediationEvents??[]).filter(event=>!offerRecordIds.has(event.recordId));if(!events.length)return '';
 return `<section class="mediation-results" aria-labelledby="mediation-result-title"><span>평화 협상 결과</span><h3 id="mediation-result-title">조건에 대한 양측의 회신</h3>${events.map(event=>{const record=(state.mediations??[]).find(item=>item.id===event.recordId),status=record?.status??event.type.replace('mediation_',''),relations=record?.relationChanges??event.relationChanges??[],transfers=record?.transfers??event.transfers,outcome=RESULTS[status]??'중재 기록';return `<article data-mediation-event="${escape(event.type)}"><header><strong>${escape(outcome)}</strong><span>${event.turn}분기</span></header><p>${escape(event.text)}</p>${record?.costs&&(record.costs.food||record.costs.money)?`<p class="mediation-paid">실제 이행 · 식량 ${record.costs.food}, 국고 ${record.costs.money}</p>`:''}${transfers&&(transfers.foodShares?.length||transfers.moneyShares?.length)?`<p>배분 · 식량 ${escape(splitText(transfers.foodShares))} · 재정 ${escape(splitText(transfers.moneyShares))}</p>`:''}${relations.length?`<ul class="mediation-relation-list">${relations.map(item=>`<li>${escape(name(item.a))}–${escape(name(item.b))} 관계 ${item.before} → <strong>${item.after}</strong> (${item.delta>0?'+':''}${item.delta})</li>`).join('')}</ul>`:''}${record?.reactions?.length?`<div class="mediation-result-reasons"><strong>국가별 판단 근거</strong>${renderConsent(record.reactions)}</div>`:''}</article>`;}).join('')}</section>`;
}

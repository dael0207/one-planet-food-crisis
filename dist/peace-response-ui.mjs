import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=30';
import {peaceResponseMarketContext,peaceResponsePairs,peaceResponseSummary} from './peace-response-model.mjs?v=30';
import {escape} from './render.mjs?v=30';

const STATUS={active:'시행 중',proposed:'회신 대기',expired:'종료',settled:'회신 처리 종료'};
const EVENT={peace_response_sanction:'타국 제재 선언',peace_response_aid:'동맹 긴급 지원',peace_response_expired:'타국 제재 종료',peace_response_proposed:'타국 재협상 제안'};
const name=id=>COUNTRIES[id]?.name??id;
const names=ids=>(ids??[]).map(name).join(' · ');
const responseOf=(state,accord)=>peaceResponseSummary(state,accord)??accord?.foreignResponse??null;
const isResponseEvent=event=>event?.source==='peace_response'||String(event?.type??'').startsWith('peace_response_');

function horizon(state,response,phase){
 const execution=phase==='decision'?state.turn+1:state.turn;
 if(response.status==='proposed')return execution>=response.untilTurn?`${response.untilTurn-1}분기 회신 기한 종료 · 제안 정리 대기`:`${response.untilTurn-1}분기까지 회신 실행 · 서명 전에는 효력 없음`;
 if(response.status==='settled')return '외국 대응 종료 · 실제 회신 결과는 외교 기록 유지';
 if(response.status==='expired')return '교역 제한 종료 · 외교 기록 유지';
 const remaining=Math.max(0,response.untilTurn-execution);
 if(execution<response.startsTurn)return `${response.startsTurn}분기부터 ${response.untilTurn-1}분기까지 · 총 ${response.untilTurn-response.startsTurn}회`;
 if(!remaining)return phase==='decision'?'다음 명령부터 제한 종료':'이번 분기로 제한 종료';
 if(phase==='result'&&remaining===1)return '이번 분기로 제한 종료';
 return `${response.untilTurn-1}분기까지 · ${phase==='decision'?'다음 명령부터':'이번 분기 포함'} ${remaining}회`;
}

function ownImpact(state,response){
 const execution={...state,turn:state.turn+1,peaceResponseForecastTurn:state.turn+1};
 const pairs=peaceResponsePairs(execution).filter(item=>item.accordId===response.accordId&&(item.fromId===state.playerId||item.toId===state.playerId));
 const partners=[...new Set(pairs.map(item=>item.fromId===state.playerId?item.toId:item.fromId))],contexts=COUNTRY_IDS.filter(id=>id!==state.playerId).map(id=>({id,...peaceResponseMarketContext(execution,id,'buy')})).filter(item=>item.scoreDelta||item.reasons?.length);
 return `<div class="peace-response-own"><strong>우리에게 실제 미치는 영향</strong>${partners.length?`<p>${escape(names(partners))}와의 우리 상업 교역이 제한됩니다. 인도적 지원은 계속됩니다.</p>`:'<p>우리 나라가 직접 차단된 교역 당사자는 아닙니다.</p>'}${contexts.length?`<ul>${contexts.map(item=>`<li>${escape(name(item.id))} 상업 협상 태도 ${item.scoreDelta>0?'+':''}${item.scoreDelta} · ${escape((item.reasons??[]).join(' '))}</li>`).join('')}</ul>`:'<p>현재 우리 협상에 반영될 차단 공급 의무는 없습니다.</p>'}<small>우리 정부는 제재 연합에 자동 가입하지 않으며, 별도 회신 없이 식량이나 국고를 내지 않습니다.</small></div>`;
}

export function renderPeaceResponseBrief(state,accord,phase='decision'){
 const response=responseOf(state,accord);if(!response)return '';
 if(!['active','proposed'].includes(response.status))return '';
 const proposed=response.kind==='renegotiate'||response.status==='proposed';
 return `<section class="peace-compliance-brief peace-response-brief" data-peace-response="${escape(response.status)}" aria-label="타국의 평화 합의 대응"><div><span>${proposed?'타국의 새 평화 제안':'타국의 합의 위반 대응'} · ${escape(STATUS[response.status]??response.status)}</span><strong>${escape(name(response.initiatorId))} → ${escape(name(response.targetId))}</strong><p>${escape(response.reason)} · ${escape(horizon(state,response,phase))}</p></div><button type="button" class="secondary-button" data-action="review-peace-accord" data-id="${escape(accord.id)}" ${phase==='decision'?'':'disabled'}>${phase==='decision'?'대응과 합의 검토 →':'결과 확인 후 검토'}</button></section>`;
}

export function renderPeaceResponseReview(state,accord){
 const response=responseOf(state,accord);if(!response)return '';
 const renewal=response.kind==='renegotiate',pending=response.status==='proposed',allies=response.memberIds?.filter(id=>id!==response.initiatorId)??[],proposalOpen=pending&&state.turn+1<response.untilTurn;
 const note=pending?(proposalOpen?'이 요청은 아직 합의가 아닙니다. 수락·조건 변경·거절 가운데 하나를 직접 회신해야 하며, 수락된 지원만 실제로 지급됩니다.':'회신 가능한 분기가 지났습니다. 종료 처리는 다음 실행 기록에 남고 어떤 지원도 자동 지급되지 않습니다.'):renewal?'회신 처리가 끝났습니다. 실제 합의 성립과 지급 여부는 외교 회신 기록에 남습니다.':'제재 주도국과 동맹은 실제 관계와 유효한 동맹에 따라 참여했습니다. 우리 대응 명령은 아래에서 별도로 선택할 수 있습니다.';
 return `<section class="peace-response-review" data-peace-response-review="${escape(response.status)}" aria-label="타국의 자율 대응"><h3>${renewal?(pending?'외국이 먼저 보낸 새 협상 요청':'외국 평화 회복 제안의 처리 결과'):'외국이 선언한 상업 제재'}</h3><dl class="peace-compliance-summary"><div><dt>${renewal?'제안국':'제재 주도국'}</dt><dd>${escape(name(response.initiatorId))}</dd></div><div><dt>합의 위반국</dt><dd>${escape(name(response.targetId))}</dd></div>${!renewal?`<div><dt>실제 참여 동맹</dt><dd>${escape(allies.length?names(allies):'추가 동맹 없음')}</dd></div>`:''}<div><dt>판단 근거</dt><dd>${escape(response.reason)}</dd></div><div><dt>${renewal?'현재 상태':'실행 기간'}</dt><dd>${escape(horizon(state,response,'decision'))}</dd></div></dl>${ownImpact(state,{...response,accordId:accord.id})}<p class="decision-note">${note}</p></section>`;
}

export function renderPeaceResponseResults(state){
 const offerEvents=new Set((state.lastPeaceOfferEvents??[]).map(event=>event.offerId).filter(Boolean)),events=(state.lastPeaceComplianceEvents??[]).filter(event=>isResponseEvent(event)&&!(event.type==='peace_response_proposed'&&offerEvents.has(event.offerId)));if(!events.length)return '';
 return `<section class="peace-response-results" aria-labelledby="peace-response-result-title"><span>타국의 자율 대응 결과</span><h3 id="peace-response-result-title">외국이 먼저 실행한 조치</h3>${events.map(event=>`<article data-peace-response-event="${escape(event.type)}"><header><strong>${escape(EVENT[event.type]??'타국 대응')}</strong><span>${event.turn}분기</span></header><p>${escape(event.text)}</p>${event.memberIds?.length?`<p>참여국 · ${escape(names(event.memberIds))}</p>`:''}${event.startsTurn&&event.untilTurn?`<p>실제 시행 · ${event.startsTurn}분기부터 ${event.untilTurn-1}분기까지 · 총 ${event.untilTurn-event.startsTurn}회</p>`:''}${Number(event.food??0)||Number(event.money??0)?`<p class="mediation-paid">실제 동맹 지원 · 식량 ${Number(event.food??0)}, 국고 ${Number(event.money??0)}</p>`:''}</article>`).join('')}<small>완료된 이번 분기의 외국 행동입니다. 우리 정부의 다음 명령과 비용은 별도로 선택됩니다.</small></section>`;
}

export function renderPeaceResponseWorld(state,accord){
 const response=responseOf(state,accord);if(!response)return '';
 return `<div class="peace-response-world" data-peace-response-history="${escape(response.status)}"><p><strong>${response.kind==='renegotiate'?'타국 재협상 제안':'타국 상업 제재'} · ${escape(STATUS[response.status]??response.status)}</strong></p><p>${escape(name(response.initiatorId))} → ${escape(name(response.targetId))} · ${escape(response.reason)}</p>${response.kind==='sanction'?`<small>참여국 ${escape(names(response.memberIds))} · ${escape(horizon(state,response,'decision'))}</small>`:`<small>${escape(horizon(state,response,'decision'))}</small>`}</div>`;
}

export function peaceResponseEvents(state){return (state.lastPeaceComplianceEvents??[]).filter(isResponseEvent);}

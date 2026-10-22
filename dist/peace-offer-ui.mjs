import {COUNTRIES} from './country-data.mjs?v=29';
import {pendingPeaceOffers,peaceOfferAction,peaceOfferPreview,peaceReplyCommand} from './peace-offers.mjs?v=29';
import {renderMediationPreview,renderMediationTerms} from './mediation-ui.mjs?v=29';
import {renderConsent} from './mediation-insight.mjs?v=29';
import {escape} from './render.mjs?v=29';

const GOALS={relief:'교역 제재 완화',peace:'분쟁 완전 종결'};
const CONDITIONS={mutual:'양측의 상호 양보',target:'대응국의 단독 양보'};
const STATUS={accepted:'합의 성립',countered:'상대 역제안',rejected:'조건 거절',escalated:'갈등 확대',declined:'제안 거절',expired:'회신 기한 종료',cancelled:'분쟁 종료로 취소',pending:'검토 대기'};
const name=id=>COUNTRIES[id]?.name??id;
const offerById=(state,id)=>(state.peaceOffers??[]).find(item=>item.id===id)??null;
const isRenewal=offer=>offer?.origin==='peace_response'&&Boolean(offer.accordId);
const offerLabel=offer=>isRenewal(offer)?'타국의 평화 회복 제안':'타국 평화 전문';

function termsLine(terms){return `${GOALS[terms.goal]??terms.goal} · ${CONDITIONS[terms.condition]??terms.condition} · 식량 ${terms.food} · 국고 ${terms.money}`;}
function replyStatus(reply,status){if(!reply)return STATUS[status]??status;if(reply.kind==='accept'&&reply.outcome==='accepted')return '원안 수락';if(reply.kind==='counter'&&reply.outcome==='accepted')return '수정안 합의';return STATUS[reply.outcome]??reply.outcome;}
function replyFacts(state,reply){
 if(!reply)return '';
 const record=(state.mediations??[]).find(item=>item.id===reply.mediationRecordId),relations=reply.relationChanges??record?.relationChanges??[],transfers=record?.transfers;
 const shares=items=>(items??[]).map(item=>`${name(item.countryId)} ${item.amount}`).join(' · ')||'이전 없음';
 return `${reply.terms?`<p>회신 조건 · ${escape(termsLine(reply.terms))}</p>`:''}<p>실제 이행 · 식량 ${Number(reply.costs?.food??0)}, 국고 ${Number(reply.costs?.money??0)}</p>${transfers&&(transfers.foodShares?.length||transfers.moneyShares?.length)?`<p>배분 · 식량 ${escape(shares(transfers.foodShares))} · 재정 ${escape(shares(transfers.moneyShares))}</p>`:''}${relations.length?`<ul class="mediation-relation-list">${relations.map(item=>`<li>${escape(name(item.a))}–${escape(name(item.b))} 관계 ${item.before} → <strong>${item.after}</strong> (${item.delta>0?'+':''}${item.delta})</li>`).join('')}</ul>`:''}${record?.reactions?.length?`<div class="mediation-result-reasons"><strong>국가별 판단 근거</strong>${renderConsent(record.reactions)}</div>`:''}`;
}
function motive(reason={}){
 return `<dl class="peace-offer-motive"><div><dt>발신국 판단</dt><dd>${escape(reason.summary??'분쟁 부담을 줄이기 위한 협상을 요청했습니다.')}</dd></div><div><dt>제안 당시 식량 · 물가</dt><dd>${Number(reason.food??0)} · ${Number(reason.price??0)}</dd></div><div><dt>분쟁 지속</dt><dd>${Number(reason.disputeAge??0)}분기</dd></div><div><dt>제안 당시 우리와의 관계</dt><dd>${Number(reason.relation??50)}점</dd></div><div><dt>제안 당시 중단 거래</dt><dd>${Number(reason.affectedTrade??0)}건</dd></div><div><dt>제안 당시 합의 전망</dt><dd>${reason.currentlyAcceptable===false?`반응 점수 ${Number(reason.acceptanceGap??0)} 보완 필요`:'당시 양국의 동의 가능'}</dd></div></dl>`;
}

export function renderPeaceOfferBrief(state,phase='decision'){
 const offers=pendingPeaceOffers(state);if(!offers.length)return '';
 const offer=offers[0];return `<section class="peace-offer-brief" data-peace-offer-origin="${isRenewal(offer)?'peace-response':'dispute'}" aria-label="도착한 평화 협상 제안"><div><span>${offerLabel(offer)} · ${offers.length}건</span><strong>${escape(name(offer.fromId))}의 ${escape(GOALS[offer.terms.goal]??offer.terms.goal)} 요청</strong><p>${escape(offer.reason?.summary??'분쟁 조건을 검토해 달라는 요청입니다.')}</p></div><div><b>${offer.expiresTurn-1}분기까지 실행</b><button type="button" class="secondary-button" data-action="review-peace-offer" data-id="${escape(offer.id)}" ${phase==='decision'?'':'disabled'}>${phase==='decision'?'원문과 조건 검토 →':'결과 확인 후 검토'}</button></div></section>`;
}

export function renderPeaceOfferReview(state,id){
 const preview=peaceOfferPreview(state,id),offer=preview?.offer??offerById(state,id);
 if(!preview||!offer)return '<h2 id="decision-title" tabindex="-1">회신할 수 없는 제안입니다</h2><p class="event-description">기한이 지났거나 분쟁 상태가 바뀌었습니다. 외교 기록에서 종료 사유를 확인할 수 있습니다.</p><button class="secondary-button" data-action="domestic">국내 현안으로 돌아가기</button>';
 const accept=peaceOfferAction(state,peaceReplyCommand(id,'accept')),player=state.countries[state.playerId];
 const affordable=Boolean(preview.canAccept&&accept&&player.food>=accept.foodCost&&player.treasury>=accept.cost);
 const renewal=isRenewal(offer);return `<div class="decision-kicker"><span>${offerLabel(offer)} · ${escape(name(offer.fromId))}</span><span>${preview.lastReplyTurn}분기까지 실행</span></div><h2 id="decision-title" tabindex="-1">${escape(name(offer.fromId))} 측이 먼저 보낸 ${renewal?'새 합의 요청':'협상안'}</h2><p class="event-description">${escape(offer.reason?.summary??'분쟁 부담을 줄이기 위한 협상을 요청했습니다.')} ${renewal?'이 요청은 아직 합의가 아니며, 기존 위반 대응과 구분됩니다. ':''}원문을 읽고 수락, 조건 변경, 거절 가운데 하나로 회신하세요.</p><button class="text-button" type="button" data-action="domestic">국내 현안으로 돌아가기 ↗</button><div class="peace-offer-original"><span>${renewal?'외국이 제안한 새 조건':'도착한 원안'}</span><strong>${escape(termsLine(offer.terms))}</strong></div>${renderMediationPreview(state,offer.terms)}<details class="mediation-detail"><summary>발신국 배경과 합의 후 배분</summary>${motive(offer.reason)}${renderMediationTerms(state,offer.terms)}</details><p class="peace-offer-resources">현재 보유 · 식량 <strong>${player.food}</strong> · 국고 <strong>${player.treasury}</strong>${accept?` / 수락 시 실제 부담 · 식량 <strong>${accept.foodCost}</strong> · 국고 <strong>${accept.cost}</strong>`:''}</p><div class="peace-offer-actions"><button class="primary-button" type="button" data-action="peace-offer-reply" data-id="${escape(id)}" data-response="accept" ${affordable?'':'disabled'}>${affordable?'원안을 수락하고 한 분기 진행':'현재 조건으로 수락 불가'}</button><button class="secondary-button" type="button" data-action="counter-peace-offer" data-id="${escape(id)}">조건을 바꿔 역제안</button><button class="text-button" type="button" data-action="peace-offer-reply" data-id="${escape(id)}" data-response="decline">제안을 거절하고 한 분기 진행</button></div><p class="decision-note">원문 확인과 조건 편집에는 시간이 흐르지 않습니다. 수락·역제안·거절 회신은 각각 한 분기 명령이며, 수락된 조건의 실제 지원만 지급됩니다.</p>`;
}

export function renderPeaceOfferResults(state){
 const events=state.lastPeaceOfferEvents??[];if(!events.length)return '';
 return `<section class="peace-offer-results" aria-labelledby="peace-offer-result-title"><span>세계 외교 전문</span><h3 id="peace-offer-result-title">먼저 도착한 평화 제안과 회신</h3>${events.map(event=>{const offer=offerById(state,event.offerId),reply=event.reply??offer?.reply,status=replyStatus(reply,event.status);return `<article data-peace-offer-event="${escape(event.type)}" data-peace-offer-origin="${isRenewal(offer)?'peace-response':'dispute'}"><header><strong>${escape(name(event.fromId))} · ${escape(status)}</strong><span>${event.turn}분기</span></header>${isRenewal(offer)?'<p><strong>위반 뒤 새 합의 회신</strong> · 완료된 이번 분기의 결과</p>':''}<p>${escape(event.text)}</p>${offer?.terms?`<p>요청 원안 · ${escape(termsLine(offer.terms))}</p>`:''}${reply?`<p class="mediation-paid">우리 회신 · ${escape(reply.kind==='accept'?'원안 수락':reply.kind==='counter'?'조건 변경':'거절')} · ${escape(replyStatus(reply,event.status))}</p>${replyFacts(state,reply)}`:''}</article>`;}).join('')}</section>`;
}

export function renderPeaceOfferHistory(state){
 const offers=state.peaceOffers??[];if(!offers.length)return '';
 const followup=offer=>{const reply=offer.reply,record=(state.mediations??[]).find(item=>item.id===reply?.mediationRecordId);return record&&record.status!==reply.outcome?`<p>후속 협상 · ${escape(STATUS[record.status]??record.status)} · ${escape(termsLine(record.terms))}</p>`:'';};
 return `<section class="peace-offer-history"><h3>타국이 먼저 보낸 평화 제안</h3>${offers.slice(-6).toReversed().map(offer=>`<article data-peace-offer-origin="${isRenewal(offer)?'peace-response':'dispute'}"><header><strong>${escape(name(offer.fromId))} → ${escape(name(state.playerId))}</strong><span>${escape(replyStatus(offer.reply,offer.status))}</span></header>${isRenewal(offer)?'<p><strong>합의 위반 뒤 평화 회복 요청</strong> · 기존 합의와 이어지는 새 제안</p>':''}<p>${escape(offer.reason?.summary??'분쟁 조건 조정을 요청했습니다.')}</p><small>${escape(termsLine(offer.terms))} · ${offer.expiresTurn-1}분기까지 실행</small>${offer.reply?`<p>우리 회신 · ${escape(termsLine(offer.reply.terms))}</p><p>${escape(offer.reply.text)}</p>${followup(offer)}`:''}</article>`).join('')}</section>`;
}

import {COUNTRIES,COUNTRY_IDS,getAction} from './engine.mjs?v=31';
import {escape,signed} from './render.mjs?v=31';
import {getRelation,pendingCounters,previewProposal,relationLabel} from './negotiations.mjs?v=31';
import {proposalComparison,responseDistance} from './negotiation-insight.mjs?v=31';
import {quarterDate} from './calendar.mjs?v=31';

const KIND_LABELS={buy:'식량 구매',sell:'식량 판매',aid_out:'지원 보내기',aid_in:'지원 요청'};
const RESPONSE_LABELS={accept:'수락 예상',counter:'역제안 예상',reject:'거절 예상'};
const STATUS_LABELS={accepted:'수락·이행',countered:'역제안 도착',rejected:'거절',declined:'역제안 거절',expired:'기한 종료',superseded:'새 제안으로 대체'};
const DEFAULT_DRAFT={kind:'buy',food:4,money:8};

const countryName=id=>COUNTRIES[id]?.name??'상대국';
const termsText=(kind,terms)=>{
 const food=Math.round(terms?.food??0),money=Math.round(terms?.money??0);
 if(kind==='buy')return `식량 ${food} 확보 · 국고 ${money}억 지급`;
 if(kind==='sell')return `식량 ${food} 제공 · 국고 ${money}억 확보`;
 if(kind==='aid_out')return `식량 ${food} · 국고 ${money}억 무상 지원`;
 return `식량 ${food} · 국고 ${money}억 지원 요청`;
};
const effectText=effect=>`식량 ${signed(Math.round(effect?.food??0))} · 국고 ${signed(Math.round(effect?.treasury??0))}억`;
const deltaText=(value,unit='')=>value===0?'변화 없음':`${signed(value)}${unit}`;
const responseGap=proposal=>{
 const distance=responseDistance(proposal);
 if(proposal.response==='accept')return `${distance.label} · ${distance.delta}점 여유`;
 if(proposal.response==='counter')return `${distance.label} ${distance.delta}점 · 거절 기준보다 ${proposal.score-40}점 높음`;
 return `${distance.label} ${distance.delta}점 부족`;
};
const renderReasons=reasons=>{
 const items=reasons??[],priority=reason=>/이행할 수 없습니다|이행 가능한 역제안/.test(reason)?0:/1당|지원 규모|지원 여력/.test(reason)?1:2;
 const visible=items.map((reason,index)=>({reason,index})).sort((a,b)=>priority(a.reason)-priority(b.reason)||a.index-b.index).slice(0,2).map(item=>item.reason);
 if(!items.length)return '';
 return `<ul class="proposal-reasons">${visible.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul>${items.length>2?`<details class="proposal-reason-details"><summary>판단 근거 전체 ${items.length}개</summary><ul>${items.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul></details>`:''}`;
};
const renderEffects=(label,player,partner,targetId)=>`<div class="proposal-effects"><div><span>${escape(label)} · 내 나라</span><b>${escape(effectText(player))}</b></div><div><span>${escape(label)} · ${escape(countryName(targetId))}</span><b>${escape(effectText(partner))}</b></div></div>`;
function resourceLimits(state,value,proposal){
 const limits=[];
 for(const [id,effects] of [[state.playerId,proposal.playerEffect],[value.targetId,proposal.partnerEffect]])for(const metric of ['food','treasury']){
  const before=state.countries[id][metric],after=before+effects[metric],unit=metric==='treasury'?'억':'';
  if(after<0||after>100)limits.push(`${countryName(id)} ${metric==='food'?'식량':'국고'} ${before} → ${after}${unit} · ${after>100?`보관 상한 100${unit} 초과`:'보유 자원 부족'}`);
 }
 return limits.length?`<p class="proposal-resource-limit">${limits.map(escape).join('<br>')}</p>`:'';
}
const renderComparison=(state,value,previousDraft)=>{
 const comparison=proposalComparison(state,value,previousDraft);
 if(!comparison)return '';
 const before=comparison.playerEffect.treasury.before,after=comparison.playerEffect.treasury.after;
 const treasury=before<=0&&after<=0
  ?`국고 지출 ${Math.abs(before)}억 → ${Math.abs(after)}억 (${deltaText(Math.abs(after)-Math.abs(before),'억')})`
  :before>=0&&after>=0?`국고 수입 ${before}억 → ${after}억 (${deltaText(after-before,'억')})`
  :`국고 변화 ${signed(before)}억 → ${signed(after)}억 (${deltaText(after-before,'억')})`;
 return `<div class="proposal-comparison" data-proposal-comparison><strong>이전 조건과 비교</strong><p>조건 · 식량 ${comparison.terms.food.before} → ${comparison.terms.food.after} (${deltaText(comparison.terms.food.delta)}) · 국고 ${comparison.terms.money.before}억 → ${comparison.terms.money.after}억 (${deltaText(comparison.terms.money.delta,'억')})</p><p>준비도 ${comparison.score.before} → ${comparison.score.after} (${deltaText(comparison.score.delta,'점')}) · ${escape(RESPONSE_LABELS[comparison.response.before])} → ${escape(RESPONSE_LABELS[comparison.response.after])}</p><p>내 부담 · ${treasury} · 식량 변화 ${signed(comparison.playerEffect.food.before)} → ${signed(comparison.playerEffect.food.after)}</p></div>`;
};
const normalizeDraft=(state,draft={})=>({
 targetId:COUNTRY_IDS.includes(draft.targetId)&&draft.targetId!==state.playerId?draft.targetId:COUNTRY_IDS.find(id=>id!==state.playerId),
 kind:KIND_LABELS[draft.kind]?draft.kind:DEFAULT_DRAFT.kind,
 food:draft.food===undefined?DEFAULT_DRAFT.food:Number(draft.food),
 money:draft.money===undefined?DEFAULT_DRAFT.money:Number(draft.money)
});
const inputValue=value=>Number.isFinite(value)?String(value):'';
const latestResult=state=>{
 const command=state.history.at(-1)?.policyId??state.commands?.at(-1)??'';
 if(command.startsWith('reply:')){
  const record=(state.negotiations??[]).find(item=>item.id===command.split(':')[1]);
  if(record)return record;
 }
 if(command.startsWith('propose:'))return (state.negotiations??[]).find(record=>record.createdTurn===state.turn);
 const resolved=(state.negotiations??[]).filter(record=>record.resolvedTurn===state.turn);
 return resolved.at(-1)??(state.negotiations??[]).filter(record=>record.createdTurn===state.turn).at(-1);
};

export function renderProposalTerms(draft){
 return `<span>이번 분기 1회 조건</span><strong>${escape(termsText(draft.kind,draft))}</strong>`;
}

export function renderProposalPreview(state,draft,previousDraft){
 const value=normalizeDraft(state,draft),proposal=previewProposal(state,value);
 if(!proposal.valid)return `<div class="proposal-preview invalid" role="status"><strong>조건을 조정해 주세요 · 이동 0</strong><p>${escape(proposal.error??'이 조건으로는 제안을 보낼 수 없습니다.')}</p></div>`;
 const counter=proposal.response==='counter'&&proposal.counterTerms?(()=>{
  const terms=proposal.counterTerms,counterPreview=previewProposal(state,{...value,...terms});
  return `<div class="counter-preview"><span>상대가 제시할 이행 가능 조건</span><strong>${escape(termsText(value.kind,terms))}</strong><p>식량 ${value.food} → ${terms.food} (${deltaText(terms.food-value.food)}) · 국고 ${value.money}억 → ${terms.money}억 (${deltaText(terms.money-value.money,'억')})</p></div><div class="proposal-no-transfer"><strong>현재 예상 이행 0</strong><p>역제안은 아직 합의가 아닙니다. 식량과 국고는 이동하지 않습니다.</p></div>${renderEffects('역제안을 나중에 수락하면',counterPreview.playerEffect,counterPreview.partnerEffect,value.targetId)}`;
 })():'';
 const outcome=proposal.response==='accept'
  ?renderEffects('수락 시 실제 제안 이행',proposal.playerEffect,proposal.partnerEffect,value.targetId)
  :proposal.response==='reject'?`<div class="proposal-no-transfer"><strong>현재 예상 이행 0</strong><p>거절되면 식량과 국고는 이동하지 않습니다.</p></div>${renderEffects('이 조건이 수락되는 경우',proposal.playerEffect,proposal.partnerEffect,value.targetId)}`:'';
 return `<div class="proposal-preview" data-proposal-response="${escape(proposal.response)}" data-proposal-score="${proposal.score}"><p class="sr-only" role="status" aria-atomic="true">${escape(countryName(value.targetId))}. ${escape(termsText(value.kind,value))}. ${escape(RESPONSE_LABELS[proposal.response])}. 준비도 ${proposal.score}점. ${escape(responseGap(proposal))}.</p><div class="proposal-attitude"><span>현재 예상 반응 · 결정값</span><strong class="response-${escape(proposal.response)}">${escape(RESPONSE_LABELS[proposal.response]??'검토 예상')}</strong></div><div class="proposal-readiness"><span>협상 준비도 <b>${proposal.score}점</b></span><span>${escape(responseGap(proposal))}</span></div><p class="proposal-thresholds">수락 65점 이상 · 역제안 40–64점 · 거절 0–39점</p>${renderComparison(state,value,previousDraft)}${resourceLimits(state,value,proposal)}${renderReasons(proposal.reasons)}${counter}${outcome}<small>준비도는 확률이 아닌 현재 조건의 결정값입니다. 양국 관계·자원·제안 조건을 바꾸면 같은 규칙으로 다시 계산됩니다.</small></div>`;
}

export function renderProposal(state,draft={},previousDraft=null){
 const value=normalizeDraft(state,draft),target=state.countries[value.targetId];
 const proposal=previewProposal(state,value),relation=getRelation(state,state.playerId,value.targetId);
 const minimumMoney=value.kind==='buy'||value.kind==='sell'?1:0;
 const date=quarterDate(state.turn),calendar=`${date.year}년 ${date.quarter}분기`;
 return `<div class="decision-kicker"><span>내가 먼저 보내는 제안</span><span>${calendar}</span></div><h2 id="decision-title" tabindex="-1">어느 나라와 무엇을 협상할까요?</h2><p class="event-description">이번 분기에 한 번만 이행할 정확한 조건을 정합니다. 제안서를 열거나 조건을 고치는 동안에는 시간이 흐르지 않습니다.</p><button class="text-button" type="button" data-action="domestic">국내 현안으로 돌아가기 ↗</button><form id="negotiation-form"><div class="proposal-fields"><label>상대국<select name="targetId">${COUNTRY_IDS.filter(id=>id!==state.playerId).map(id=>`<option value="${id}" ${id===value.targetId?'selected':''}>${escape(countryName(id))}</option>`).join('')}</select></label><label>제안 종류<select name="kind">${Object.entries(KIND_LABELS).map(([kind,label])=>`<option value="${kind}" ${kind===value.kind?'selected':''}>${label}</option>`).join('')}</select></label><label>식량 수량 <small>1–12</small><input name="food" type="number" min="1" max="12" step="1" value="${escape(inputValue(value.food))}" inputmode="numeric" required></label><label>국고 금액 <small>${minimumMoney}–30억</small><input name="money" type="number" min="${minimumMoney}" max="30" step="1" value="${escape(inputValue(value.money))}" inputmode="numeric" required></label></div><div class="target-snapshot"><div><span>${escape(countryName(value.targetId))} 식량</span><b>${Math.round(target?.food??0)}</b></div><div><span>${escape(countryName(value.targetId))} 국고</span><b>${Math.round(target?.treasury??0)}억</b></div><div><span>양국 관계</span><b>${Math.round(relation)}점</b><small>${escape(relationLabel(relation))}</small></div></div><div class="terms-summary" id="proposal-terms">${renderProposalTerms(value)}</div><div id="proposal-preview">${renderProposalPreview(state,value,previousDraft)}</div><button class="primary-button" type="submit" id="send-proposal" ${proposal.valid?'':'disabled'}>이 조건으로 제안하고 한 분기 진행 <span aria-hidden="true">→</span></button></form><p class="decision-note">보내기, 역제안 수락 또는 거절을 확정하면 한 분기가 흐릅니다. 역제안이나 거절에는 제안한 식량·국고가 빠져나가지 않습니다.</p>`;
}

export function renderOutbound(state,flow){
 const canDecide=flow.phase==='decision',counters=pendingCounters(state);
 return `<section class="outbound-diplomacy" aria-labelledby="outbound-title"><div class="outbound-heading"><div><span class="eyebrow">YOU REACH OUT</span><h2 id="outbound-title">내가 먼저 하는 외교</h2></div><button class="secondary-button" data-action="open-proposal" ${canDecide?'':'disabled'}>${canDecide?'새 무역·지원 제안 →':'결과 확인 후 제안 가능'}</button></div><p class="quiet-copy">다섯 나라 중 한 곳을 골라 이번 분기 한 번의 무역이나 지원을 제안할 수 있습니다. 조건 편집만으로는 시간이 흐르지 않습니다.</p>${counters.length?`<div class="counter-list"><h3>결정을 기다리는 역제안 <span>${counters.length}</span></h3>${counters.map(record=>{
  const terms=record.counterTerms??record.terms,accept=getAction(state,`reply:${record.id}:accept`);
  return `<article class="counter-card"><div class="dispatch-meta"><span>${escape(countryName(record.targetId))} · ${escape(KIND_LABELS[record.kind]??'외교 제안')}</span><strong>${Math.max(0,(record.expiresTurn??state.turn)-state.turn)}분기 내 회신</strong></div><h4>${escape(termsText(record.kind,terms))}</h4><p>${escape(record.reasons?.at(-1)??'상대국이 조건을 바꾸어 다시 제안했습니다.')}</p><div class="counter-actions"><button class="primary-button" data-action="negotiation-reply" data-id="${escape(record.id)}" data-response="accept" ${canDecide&&accept?'':'disabled'}>${accept?'역제안 수락':'현재 자원으로 수락 불가'}</button><button class="secondary-button" data-action="negotiation-reply" data-id="${escape(record.id)}" data-response="decline" ${canDecide?'':'disabled'}>거절</button></div></article>`;
 }).join('')}</div>`:'<p class="outbound-empty">현재 답해야 할 역제안이 없습니다.</p>'}</section>`;
}

export function renderNegotiationResult(state){
 const record=latestResult(state);
 if(!record)return '';
 const accepted=record.status==='accepted',terms=record.settlement?.terms??record.counterTerms??record.terms;
 const transfer=accepted?`<div class="settlement-deltas"><div><span>협상으로 바뀐 내 식량</span><b>${signed(Math.round(record.settlement?.foodDelta??0))}</b></div><div><span>협상으로 바뀐 내 국고</span><b>${signed(Math.round(record.settlement?.moneyDelta??0))}억</b></div></div>`:'<div class="zero-settlement"><strong>협상 거래량 0</strong><p>제안한 식량과 국고는 이동하지 않았습니다. 아래의 일반 분기 변화는 날씨·생산·타국 행동·기존 협정에서 생긴 값입니다.</p></div>';
 return `<section class="negotiation-result status-${escape(record.status)}"><span class="eyebrow">OUTBOUND DIPLOMACY RESULT</span><h3>${escape(countryName(record.targetId))}: ${escape(STATUS_LABELS[record.status]??'협상 처리')}</h3><div class="result-terms"><div><span>내가 보낸 조건</span><b>${escape(termsText(record.kind,record.terms))}</b></div>${record.counterTerms?`<div><span>상대가 바꾼 조건</span><b>${escape(termsText(record.kind,record.counterTerms))}</b></div>`:''}${accepted?`<div><span>실제 이행 조건</span><b>${escape(termsText(record.kind,terms))}</b></div>`:''}</div>${transfer}<p class="relation-change">양국 관계 ${Math.round(record.replyRelationBefore??record.relationBefore??0)} → <strong>${Math.round(record.relationAfter??record.relationBefore??0)}</strong></p>${record.reasons?.length?`<p class="quiet-copy">제안 검토 당시의 판단</p>${renderReasons(record.reasons)}`:''}</section>`;
}

export function renderNegotiationHistory(state){
 const records=(state.negotiations??[]).slice(-8).toReversed();
 return `<section class="negotiation-history" aria-labelledby="negotiation-history-title"><h3 id="negotiation-history-title" class="result-subheading">내가 먼저 보낸 외교 기록</h3>${records.length?records.map(record=>`<article><div><span>${record.createdTurn}분기 · ${escape(countryName(record.targetId))}</span><strong>${escape(STATUS_LABELS[record.status]??'검토 중')}</strong></div><b>${escape(KIND_LABELS[record.kind]??'외교 제안')}</b><p>제안: ${escape(termsText(record.kind,record.terms))}${record.counterTerms?`<br>역제안: ${escape(termsText(record.kind,record.counterTerms))}`:''}</p></article>`).join(''):'<p class="quiet-copy">아직 먼저 보낸 제안이 없습니다.</p>'}</section>`;
}

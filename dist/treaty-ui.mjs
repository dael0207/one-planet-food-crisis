import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=30';
import {escape,signed} from './render.mjs?v=30';
import {previewTreaty,treatyCommand,activeTreaties,getReliability} from './treaties.mjs?v=30';
import {treatyComparison,treatyResponseDistance} from './treaty-insight.mjs?v=30';
import {quarterDate} from './calendar.mjs?v=30';

const KINDS={trade_buy:'식량 장기 수입 협정',trade_sell:'식량 장기 수출 협정',alliance:'식량 상호지원 동맹'};
const STATUS={active:'이행 중',completed:'정상 완료',broken:'자발적 파기',cancelled:'상대국 종료',rejected:'체결 거절'};
const EVENT={accepted:'협정 체결',rejected:'체결 거절',fulfilled:'약속 이행',breach:'약속 불이행',standby:'동맹 대기',suspended:'제재로 이행 중지',completed:'협정 완료',broken:'협정 파기',cancelled:'협정 종료'};

const countryName=id=>COUNTRIES[id]?.name??'상대국';
const asNumber=(value,fallback)=>value===undefined||value===null||value===''?fallback:Number(value);
const treatyList=state=>Array.isArray(state.treaties)?state.treaties:[];
const allEvents=state=>Array.isArray(state.lastTreatyEvents)?state.lastTreatyEvents:[];
const findTreaty=(state,id)=>treatyList(state).find(item=>item.id===id);
const RESPONSE={accept:'수락 예상',reject:'거절 예상'};
const deltaText=(value,unit='')=>value===0?'변화 없음':`${signed(value)}${unit}`;

function normalizeDraft(state,draft={}){
 const targetId=COUNTRY_IDS.includes(draft.targetId)&&draft.targetId!==state.playerId?draft.targetId:COUNTRY_IDS.find(id=>id!==state.playerId);
 const kind=Object.hasOwn(KINDS,draft.kind)?draft.kind:'trade_buy';
 return {targetId,kind,food:asNumber(draft.food,kind==='alliance'?3:4),money:asNumber(draft.money,kind==='alliance'?0:8),duration:draft.duration===undefined||draft.duration===null||draft.duration===''?4:Number(draft.duration)};
}

function obligations(draft){
 const value=normalizeTerms(draft),partner=countryName(value.targetId);
 if(value.kind==='trade_buy')return {player:`매 분기 국고 ${value.money}억 지급`,partner:`매 분기 식량 ${value.food} 제공`,summary:`${partner}에서 매 분기 식량 ${value.food} 확보 · 국고 ${value.money}억 지급`};
 if(value.kind==='trade_sell')return {player:`매 분기 식량 ${value.food} 제공`,partner:`매 분기 국고 ${value.money}억 지급`,summary:`${partner}에 매 분기 식량 ${value.food} 제공 · 국고 ${value.money}억 확보`};
 return {player:`위기 시 식량 최대 ${value.food}·지원금 최대 ${value.money}억`,partner:`위기 시 식량 최대 ${value.food}·지원금 최대 ${value.money}억`,summary:`어느 한 나라의 식량이 35 미만이면 상대가 식량 최대 ${value.food} 지원`};
}

function normalizeTerms(draft={}){
 return {targetId:draft.targetId,kind:Object.hasOwn(KINDS,draft.kind)?draft.kind:'trade_buy',food:asNumber(draft.food,0),money:asNumber(draft.money,0),duration:asNumber(draft.duration,4)};
}

function amountText(kind,food,money){
 if(kind==='alliance')return `식량 최대 ${food}${money?` · 지원금 최대 ${money}억`:''}`;
 return `식량 ${food} · 국고 ${money}억`;
}

export function renderTreatyTerms(input={}){
 const draft=normalizeTerms(input),terms=obligations(draft),totalFood=draft.food*draft.duration,totalMoney=draft.money*draft.duration;
 const totals=draft.kind==='alliance'?`약정 한도는 발동 때마다 식량 ${draft.food}${draft.money?`·지원금 ${draft.money}억`:''}입니다. 지원금은 도움받는 나라의 국고가 25억 미만일 때만 보내며, 대기 분기에는 자원이 이동하지 않습니다.`:`전체 ${draft.duration}분기를 모두 이행하면 식량 ${totalFood}·국고 ${totalMoney}억이 이동합니다.`;
 return `<div class="treaty-terms-card"><span>분기별 약속</span><strong>${escape(terms.summary)}</strong><p>${escape(totals)}</p><small>상대국이 수락하면 체결한 이번 분기부터 첫 이행을 시작합니다.</small></div>`;
}

function renderTreatyReasons(reasons=[]){
 const priority=reason=>/거래가 중단|상업 거래 제한|제재/.test(reason)?0:/감당하기 어렵|이익이 충분하지/.test(reason)?1:/분기 동안|1당|위기 시 최대/.test(reason)?2:3;
 const visible=reasons.map((reason,index)=>({reason,index})).sort((a,b)=>priority(a.reason)-priority(b.reason)||a.index-b.index).slice(0,3).map(item=>item.reason);
 if(!reasons.length)return '';
 return `<ul class="treaty-reasons">${visible.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul>${reasons.length>visible.length?`<details class="treaty-reason-details"><summary>판단 근거 전체 ${reasons.length}개</summary><ul>${reasons.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul></details>`:''}`;
}

function obligationDifference(kind,terms){
 const food=`${terms.food.before} → ${terms.food.after} (${deltaText(terms.food.delta)})`,money=`${terms.money.before}억 → ${terms.money.after}억 (${deltaText(terms.money.delta,'억')})`;
 if(kind==='trade_buy')return `분기당 확보 식량 ${food} · 분기당 지급 국고 ${money}`;
 if(kind==='trade_sell')return `분기당 제공 식량 ${food} · 분기당 확보 국고 ${money}`;
 return `위기 시 식량 한도 ${food} · 지원금 한도 ${money}`;
}

function renderTreatyComparison(state,draft,previousDraft){
 const comparison=treatyComparison(state,draft,previousDraft);
 if(!comparison)return '';
 return `<div class="treaty-comparison" data-treaty-comparison><strong>이전 조건과 비교</strong><p>준비도 ${comparison.score.before} → ${comparison.score.after} (${deltaText(comparison.score.delta,'점')}) · ${RESPONSE[comparison.response.before]} → ${RESPONSE[comparison.response.after]}</p><p>기간 ${comparison.terms.duration.before} → ${comparison.terms.duration.after}분기 (${deltaText(comparison.terms.duration.delta,'분기')})</p><p>${obligationDifference(draft.kind,comparison.terms)}</p></div>`;
}

export function renderTreatyPreview(state,input={},previousDraft=null){
 const draft=normalizeDraft(state,input),preview=previewTreaty(state,draft);
 if(!preview.valid)return `<div class="treaty-preview invalid" role="status"><strong>조건을 조정해 주세요 · 체결과 이행 없음</strong><p>${escape(preview.error??'장기 협정 조건을 다시 확인해 주세요.')}</p></div>`;
 const distance=treatyResponseDistance(preview),gap=preview.response==='accept'?`${distance.label} · ${distance.delta}점 여유`:`${distance.label} ${distance.delta}점 부족`;
 const outcome=preview.response==='accept'?`<div class="treaty-forecast-outcome"><strong>수락 시 약정 시작</strong><p>체결한 이번 분기부터 첫 의무를 실행하며, 실제 이동은 그 분기의 보유 자원과 약정 규칙을 따릅니다.</p></div>`:`<div class="treaty-forecast-outcome no-treaty"><strong>현재 예상 체결 없음 · 이행 0</strong><p>거절되면 장기 의무가 생기지 않고 식량과 국고도 이동하지 않습니다.</p></div>`;
 return `<div class="treaty-preview response-${escape(preview.response)}" data-treaty-response="${escape(preview.response)}" data-treaty-score="${preview.score}"><p class="sr-only" role="status" aria-atomic="true">${escape(countryName(draft.targetId))}. ${draft.duration}분기, ${draft.kind==='alliance'?'위기 시 한도':'분기당'} 식량 ${draft.food}, 국고 ${draft.money}억. ${RESPONSE[preview.response]}. 준비도 ${preview.score}점. ${escape(gap)}.</p><div class="treaty-attitude"><span>현재 예상 반응 · 결정값</span><strong>${RESPONSE[preview.response]}</strong></div><div class="treaty-readiness"><span>협정 준비도 <b>${preview.score}점</b></span><span>${escape(gap)}</span><span>약정 기간 ${draft.duration}분기</span></div><p class="treaty-threshold">수락 기준 52점 이상 · 0–51점은 거절</p><div class="treaty-trust-row"><span>양국 관계 <b>${Math.round(preview.relation)}점</b></span><span>우리 약속 신뢰도 <b>${Math.round(preview.reliability)}점</b></span></div>${renderTreatyComparison(state,draft,previousDraft)}${renderTreatyReasons(preview.reasons)}${outcome}<small>준비도는 확률이 아닌 현재 조건의 결정값입니다. 관계·신뢰도·자원·기간과 분기별 약속을 같은 규칙으로 계산합니다.</small></div>`;
}

export function renderTreatyForm(state,draft={},previousDraft=null){
 const value=normalizeDraft(state,draft),preview=previewTreaty(state,value),target=state.countries[value.targetId],relation=Math.round(preview.relation??0),reliability=Math.round(getReliability(state,value.targetId));
 const moneyMin=value.kind==='alliance'?0:1,moneyMax=value.kind==='alliance'?6:20,foodMax=value.kind==='alliance'?6:8;
 const date=quarterDate(state.turn),calendar=`${date.year}년 ${date.quarter}분기`;
 return `<div class="decision-kicker"><span>장기 협정</span><span>${calendar}</span></div><h2 id="decision-title" tabindex="-1">여러 계절을 함께할 약속을 정하세요</h2><p class="event-description">조건을 편집하거나 파기 검토 화면을 여는 동안에는 시간이 흐르지 않습니다. 제안을 보내면 한 분기가 흐르고, 수락된 협정은 이번 분기부터 이행됩니다.</p><button class="text-button" type="button" data-action="domestic">국내 현안으로 돌아가기 ↗</button><form id="treaty-form"><div class="treaty-fields"><label>상대국<select name="targetId">${COUNTRY_IDS.filter(id=>id!==state.playerId).map(id=>`<option value="${id}" ${id===value.targetId?'selected':''}>${escape(countryName(id))}</option>`).join('')}</select></label><label>협정 종류<select name="kind">${Object.entries(KINDS).map(([kind,label])=>`<option value="${kind}" ${kind===value.kind?'selected':''}>${escape(label)}</option>`).join('')}</select></label><label>유지 기간<select name="duration">${[4,8,12].map(duration=>`<option value="${duration}" ${duration===value.duration?'selected':''}>${duration}분기</option>`).join('')}</select></label><label>분기당 식량 <small>1–${foodMax}</small><input name="food" type="number" min="1" max="${foodMax}" step="1" value="${value.food}" inputmode="numeric" required></label><label>분기당 국고 <small>${moneyMin}–${moneyMax}억</small><input name="money" type="number" min="${moneyMin}" max="${moneyMax}" step="1" value="${value.money}" inputmode="numeric" required></label></div><div class="treaty-target-snapshot"><div><span>${escape(countryName(value.targetId))} 식량</span><b>${Math.round(target?.food??0)}</b></div><div><span>${escape(countryName(value.targetId))} 국고</span><b>${Math.round(target?.treasury??0)}억</b></div><div><span>양국 관계</span><b>${relation}점</b></div><div><span>상대 약속 신뢰도</span><b>${reliability}점</b><small>국가 전반의 외교 신뢰와 별도</small></div></div><div id="treaty-terms">${renderTreatyTerms(value)}</div><div id="treaty-preview">${renderTreatyPreview(state,value,previousDraft)}</div><button class="primary-button" type="submit" id="send-treaty" ${preview.valid?'':'disabled'}>이 조건으로 제안하고 한 분기 진행 <span aria-hidden="true">→</span></button></form><p class="decision-note">자원은 상대국이 수락한 경우에만 이동합니다. 이후 매 분기의 부족분이나 파기는 양국 관계와 약속 신뢰도, 다른 나라의 반응에 남습니다.</p>`;
}

function lastOutcome(treaty){
 if(treaty.lastOutcome)return typeof treaty.lastOutcome==='string'?treaty.lastOutcome:treaty.lastOutcome.text??EVENT[treaty.lastOutcome.type]??'최근 이행이 기록되었습니다.';
 const event=treaty.events?.at(-1);
 if(!event)return '아직 첫 이행 기록이 없습니다.';
 return event.text??EVENT[event.type]??'최근 이행이 기록되었습니다.';
}

export function renderTreatyLedger(state,flow={phase:'decision'}){
 const canDecide=flow.phase==='decision',list=activeTreaties(state);
 return `<section class="treaty-ledger" aria-labelledby="treaty-ledger-title"><div class="treaty-ledger-heading"><div><span class="eyebrow">DURABLE COMMITMENTS</span><h2 id="treaty-ledger-title">장기 협정과 동맹</h2></div><button class="secondary-button" type="button" data-action="open-treaty" ${canDecide?'':'disabled'}>${canDecide?'장기 협정·동맹 제안 →':'결과 확인 후 제안 가능'}</button></div><p class="quiet-copy">약속 신뢰도는 실제 이행 기록으로 변하며, 국가 전반의 외교 신뢰와 별도로 계산됩니다.</p>${list.length?`<div class="treaty-card-list">${list.map(treaty=>{
  const targetId=treaty.playerId===state.playerId?treaty.targetId:treaty.playerId,remaining=Math.max(0,(treaty.endTurn??state.turn)-state.turn-1),reliability=Math.round(getReliability(state,targetId));
  return `<article class="treaty-card"><div class="treaty-card-top"><div><span>${escape(countryName(targetId))}</span><h3>${escape(KINDS[treaty.kind]??'장기 협정')}</h3></div><strong>${remaining}회 남음</strong></div><p class="treaty-obligation">${escape(amountText(treaty.kind,treaty.food,treaty.money))} · ${treaty.duration}분기 약정</p><div class="treaty-ledger-stats"><div><span>이행</span><b>${treaty.fulfilled??0}회</b></div><div><span>불이행</span><b>${treaty.breaches??0}회</b></div><div><span>연속 불이행</span><b>${treaty.streak??0}회</b></div><div><span>우리 약속 신뢰도</span><b>${Math.round(getReliability(state,state.playerId))}점</b></div><div><span>상대 약속 신뢰도</span><b>${reliability}점</b></div></div><p class="treaty-last"><span>최근 기록</span>${escape(lastOutcome(treaty))}</p><button class="text-button treaty-break-link" type="button" data-action="review-treaty-break" data-id="${escape(treaty.id)}" ${canDecide?'':'disabled'}>이 협정 파기 영향 검토 ↗</button></article>`;
 }).join('')}</div>`:'<div class="treaty-empty"><strong>현재 이행 중인 장기 약속이 없습니다.</strong><p>협정을 제안해 여러 분기의 공급을 묶거나, 식량 위기에 서로 돕는 동맹을 맺을 수 있습니다.</p></div>'}</section>`;
}

function eventMovement(event,treaty){
 const promisedFood=event.promisedFood??treaty?.food??0,promisedMoney=event.promisedMoney??treaty?.money??0,actualFood=event.food??event.actualFood??0,actualMoney=event.money??event.actualMoney??0;
 if(event.type==='standby')return '<p class="treaty-standby">양국 모두 식량 35 이상이어서 지원 의무가 발동하지 않았습니다. 대기는 가상의 이행 횟수로 계산되지 않습니다.</p>';
 if(!['fulfilled','breach'].includes(event.type))return '';
 return `<div class="treaty-movement"><div><span>약속</span><b>${escape(amountText(treaty?.kind,promisedFood,promisedMoney))}</b></div><div><span>실제 이동</span><b>${escape(treaty?.kind==='alliance'?`식량 ${actualFood} · 지원금 ${actualMoney}억`:amountText(treaty?.kind,actualFood,actualMoney))}</b></div></div>`;
}

export function renderTreatyResults(state){
 const events=allEvents(state);
 if(!events.length)return '';
 return `<section class="treaty-results" aria-labelledby="treaty-results-title"><span class="eyebrow">COMMITMENT RESULTS</span><h3 id="treaty-results-title">이번 분기의 장기 약속</h3>${events.map(event=>{
  const treaty=findTreaty(state,event.treatyId),targetId=event.targetId??(treaty?.playerId===state.playerId?treaty?.targetId:treaty?.playerId),responsible=event.actorId?countryName(event.actorId):null;
  const relation=Number.isFinite(event.relationBefore)&&Number.isFinite(event.relationAfter)?`<p class="treaty-change">양국 관계 ${Math.round(event.relationBefore)} → <strong>${Math.round(event.relationAfter)}</strong></p>`:'';
  const reliability=Number.isFinite(event.reliabilityBefore)&&Number.isFinite(event.reliabilityAfter)?`<p class="treaty-change">${responsible?`${escape(responsible)}의 `:''}약속 신뢰도 ${Math.round(event.reliabilityBefore)} → <strong>${Math.round(event.reliabilityAfter)}</strong></p>`:'';
  const observers=event.observers?.length?`<div class="observer-reactions"><span>다른 나라의 반응</span>${event.observers.map(item=>`<p><b>${escape(countryName(item.countryId))}</b> ${escape(item.text)} <strong>${signed(item.delta)}</strong></p>`).join('')}</div>`:'';
  const actorLabel=event.type==='fulfilled'?'이행 국가':'책임 국가';
  return `<article class="treaty-event event-${escape(event.type??'record')}" data-treaty-id="${escape(event.treatyId??'')}"><div class="treaty-event-heading"><div><span>${escape(countryName(targetId))}</span><h4>${escape(EVENT[event.type]??'협정 기록')}</h4></div>${responsible?`<strong>${actorLabel} · ${escape(responsible)}</strong>`:''}</div><p>${escape(event.text??'장기 협정의 변화가 기록되었습니다.')}</p>${event.reasons?.length?`<ul class="quiet-copy">${event.reasons.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul>`:''}${eventMovement(event,treaty)}${relation}${reliability}${observers}</article>`;
 }).join('')}</section>`;
}

export function renderTreatyHistory(state){
 const list=treatyList(state).filter(item=>item.status!=='active').slice(-8).toReversed();
 return `<section class="treaty-history" aria-labelledby="treaty-history-title"><h3 id="treaty-history-title" class="result-subheading">지난 장기 협정 기록</h3>${list.length?list.map(treaty=>{
  const targetId=treaty.playerId===state.playerId?treaty.targetId:treaty.playerId;
  const status=treaty.status==='completed'&&(treaty.breaches??0)>0?'기간 종료(미이행 있음)':STATUS[treaty.status]??'종료';
  return `<article><div><span>${escape(countryName(targetId))} · ${escape(KINDS[treaty.kind]??'장기 협정')}</span><strong>${escape(status)}</strong></div><p>${treaty.fulfilled??0}회 이행 · ${treaty.breaches??0}회 불이행${treaty.startTurn!=null?` · ${treaty.startTurn}분기 시작`:''}</p></article>`;
 }).join(''):'<p class="quiet-copy">아직 종료된 장기 협정이 없습니다.</p>'}</section>`;
}

export function renderBreakReview(state,id){
 const treaty=findTreaty(state,id);
 if(!treaty)return `<div class="decision-kicker"><span>COMMITMENT REVIEW</span><span>${state.turn+1}분기</span></div><h2 id="decision-title" tabindex="-1">검토할 협정을 찾을 수 없습니다</h2><p class="event-description">이미 종료되었거나 현재 운영 기록에 없는 협정입니다.</p><button class="secondary-button" type="button" data-action="domestic">국내 현안으로 돌아가기</button>`;
 const targetId=treaty.playerId===state.playerId?treaty.targetId:treaty.playerId,observers=COUNTRY_IDS.filter(countryId=>countryId!==state.playerId&&countryId!==targetId);
 return `<div class="decision-kicker"><span>BREAK COMMITMENT REVIEW</span><span>${state.turn+1}분기</span></div><h2 id="decision-title" tabindex="-1">${escape(countryName(targetId))} 측과의 약속을 끝낼까요?</h2><p class="event-description">파기 검토 화면을 여는 것만으로는 협정이 취소되거나 시간이 흐르지 않습니다. 아래 버튼으로 확정하면 한 분기가 흐릅니다.</p><div class="break-treaty-summary"><span>${escape(KINDS[treaty.kind]??'장기 협정')}</span><strong>${escape(amountText(treaty.kind,treaty.food,treaty.money))} · ${Math.max(0,(treaty.endTurn??state.turn)-state.turn-1)}회 남음</strong></div><div class="break-consequences"><h3>확정 즉시 남는 영향</h3><div><span>${escape(countryName(targetId))} 측과의 양국 관계</span><strong>-12</strong></div><div><span>우리나라 약속 신뢰도</span><strong>-12</strong></div><div><span>나머지 네 나라와의 관계</span><strong>각 -2</strong></div><p>${observers.map(countryName).map(escape).join(' · ')}도 약속을 깬 사실을 관찰합니다.</p></div><div class="break-actions"><button class="secondary-button" type="button" data-action="domestic">협정 유지하고 돌아가기</button><button class="danger-button" type="button" data-action="confirm-treaty-break" data-id="${escape(treaty.id)}">파기 확정하고 한 분기 진행</button></div>`;
}

export {treatyCommand};

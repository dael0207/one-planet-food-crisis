import {COUNTRIES} from './country-data.mjs?v=29';
import {SITE_DEFS} from './site-operations.mjs?v=29';
import {previewJointInvestment} from './joint-investments.mjs?v=29';
import {escape,signed} from './render.mjs?v=29';
import {quarterDate} from './calendar.mjs?v=29';

export const JOINT_STATUS={building:'공동 건설',active:'공동 배분',suspended:'공급 중단',completed:'계약 종료',withdrawn:'투자 철회'};
export const jointAt=(state,countryId,kind)=>(state.jointInvestments??[]).filter(item=>item.targetId===countryId&&item.kind===kind).at(-1)??null;
const dateText=turn=>{const date=quarterDate(Math.max(0,turn-1));return `${date.year}년 ${date.quarter}분기`;};
const field=(name,label,values,value,unit)=>`<label><span>${label}</span><select name="${name}">${values.map(item=>`<option value="${item}"${item===value?' selected':''}>${item}${unit}</option>`).join('')}</select></label>`;
const expectedText=(kind,preview)=>kind==='farm'?`분기 식량 최대 +${preview.expectedFood}`:`분기 수익 최대 +${preview.expectedRevenue}억`;

export function renderJointPreview(state,draft){
 const preview=previewJointInvestment(state,draft);
 if(!preview.valid)return '<p data-joint-response>투자 조건을 확인하세요.</p>';
 const blocked=preview.blockedReason||(!preview.affordable?'투자에 필요한 국고가 부족합니다.':'');
 const hardReason=preview.decisionBlocker;
 const gap=preview.score-preview.threshold;
 const response=blocked||(preview.outcome==='rejected'&&hardReason?`거절 예상 · ${hardReason}`:`${preview.outcome==='accepted'?'수락 예상':'거절 예상'} · ${gap>=0?`${gap}점 여유`:`수락까지 ${-gap}점 부족`}`);
 const schedule=preview.dueTurn===null?'':`${dateText(preview.dueTurn)} 완공 · ${dateText(preview.endTurn)} 계약 종료`;
 return `<div class="joint-response"><strong data-joint-response>${escape(response)}</strong><small>양국 관계 ${preview.relation} · 준비도 ${preview.score}/${preview.threshold}</small><details><summary>상대국 판단 근거</summary><ul class="proposal-reasons">${(preview.reasons??[]).map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul></details></div><div class="site-benefit" data-joint-terms data-cost="${preview.cost}" data-construction-cost="${preview.constructionCost}" data-due-turn="${preview.dueTurn}" data-end-turn="${preview.endTurn}" data-expected-food="${preview.expectedFood}" data-expected-revenue="${preview.expectedRevenue}"><span>우리 배분 ${draft.share}% · 현지국 ${100-draft.share}%</span><strong>${escape(expectedText(draft.kind,preview))} · ${draft.duration}분기</strong><small>${escape(schedule)} · 현장 건설비 ${preview.constructionCost}억</small><small>수락 시 현지국 건설 부담 ${Math.max(0,preview.constructionCost-draft.capital)}억 · 투자금 중 운영자금 ${Math.max(0,draft.capital-preview.constructionCost)}억</small><details><summary>배분 계산과 자원 한도</summary><small>완공 직후 기준 예상치입니다. 추가 확장 시 달라집니다. 실제 성과를 비율대로 배분하고 소수 몫은 다음 정산에 합칩니다. 항만은 유지비를 뺀 순운영 수익 기준입니다. 재고·보관 여력에 따라 줄어든 지급액은 추후 보전하지 않습니다.</small></details></div><p class="joint-risk">관계 35 미만 또는 무역 제재 시 배분 중단. 관계 45 이상이고 제재가 풀리면 재개합니다. 중단 중에도 계약 기간은 흐릅니다.</p><p id="joint-order-status" class="site-order-status" role="status" aria-atomic="true">${escape(blocked||`${preview.outcome==='accepted'?`수락 시 ${draft.capital}억 투자`:'거절 시 투자금 지출 없음'} · 제안하면 1분기 진행`)}</p>`;
}

export function renderJointForm(state,draft){
 const preview=previewJointInvestment(state,draft),enabled=preview.valid&&preview.eligible&&preview.affordable;
 return `<form id="joint-form" class="joint-form"><div class="dispatch-heading"><strong>공동 투자 조건</strong><button type="button" class="text-button" data-action="cancel-joint-investment">시설 정보로 ↗</button></div><fieldset><legend>현지국이 운영하고 성과를 나눕니다</legend><div class="joint-fields">${field('capital','내 투자금',[12,20,28],draft.capital,'억')}${field('share','우리 배분 비율',[25,50,75],draft.share,'%')}${field('duration','배분 기간',[4,8,12],draft.duration,'분기')}</div></fieldset><div id="joint-preview">${renderJointPreview(state,draft)}</div><button type="submit" id="joint-submit" class="primary-button"${enabled?'':' disabled'}>공동 투자 제안 · 1분기 진행 →</button><small class="joint-footnote">수락해야 투자금이 이전됩니다. 투자 원금은 반환되지 않습니다.</small></form>`;
}

export function renderJointContract(state,contract){
 const remaining=contract.status==='building'?`완공까지 ${Math.max(0,contract.dueTurn-state.turn)}분기`:`앞으로 ${Math.max(0,contract.endTurn-state.turn-1)}분기 배분 가능`;
 return `<div class="site-benefit joint-contract" data-joint-contract="${escape(contract.id)}" data-joint-status="${escape(contract.status)}"><span>공동 투자 · ${contract.capital}억 · 우리 몫 ${contract.share}%</span><strong>${escape(JOINT_STATUS[contract.status]??'상태 확인')} · ${escape(remaining)}</strong><small>${escape(dateText(contract.dueTurn))}부터 배분 · 누적 식량 ${contract.totalFood??0} · 수익 ${contract.totalRevenue??0}억</small><p>${escape(contract.lastReason??'현지국의 운영 결과에 따라 성과를 배분합니다.')}</p></div>`;
}

export function renderJointSection(state,view,phase,draft=null){
 if(view.owned||!['port','farm'].includes(view.kind))return '';
 if(draft&&phase==='decision')return renderJointForm(state,draft);
 const contract=jointAt(state,view.countryId,view.kind),live=contract&&['building','active','suspended'].includes(contract.status);
 const current=contract?renderJointContract(state,contract):'';
 if(phase!=='decision'||live)return current;
 const initial={targetId:view.countryId,kind:view.kind,capital:20,share:50,duration:8},preview=previewJointInvestment(state,initial);
 return current+`<div class="joint-entry"><button type="button" class="secondary-button" data-action="open-joint-investment" data-country="${view.countryId}" data-site="${view.kind}"${preview.eligible?'':' disabled'}>공동 투자 협상 →</button>${preview.blockedReason?`<small>${escape(preview.blockedReason)}</small>`:'<small>현지 시설 확장에 투자하고 식량이나 운영 수익을 나눕니다.</small>'}</div>`;
}

export function renderJointResults(state){
 const events=state.history?.at(-1)?.jointInvestmentEvents??[];
 if(!events.length)return '';
 const food=events.reduce((sum,event)=>sum+(event.playerImpact?.food??0),0),money=events.reduce((sum,event)=>sum+(event.playerImpact?.treasury??0),0);
 return `<section class="site-result-ledger joint-results" data-joint-results aria-label="공동 투자 성과"><div><span>공동 투자 · 이번 분기 실제 배분과 지출</span><strong data-joint-impact>식량 ${signed(food)} · 국고 ${signed(money)}억</strong></div><ul>${events.map(event=>`<li data-joint-event="${escape(event.operation)}"><strong>${escape(COUNTRIES[event.countryId]?.name??'현지국')} · ${escape(SITE_DEFS[event.kind]?.name??'공동 사업')}</strong><p>${escape(event.text??'')}</p><button type="button" class="text-button" data-action="open-facility" data-country="${escape(event.countryId)}" data-site="${escape(event.kind)}">공동 투자 현장 ↗</button></li>`).join('')}</ul></section>`;
}

import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=31';
import {escape,signed} from './render.mjs?v=31';
import {foreignMarketSummary} from './foreign-diplomacy.mjs?v=31';
import {renderWorldGoals} from './world-goals-ui.mjs?v=31';

const KINDS={trade_sell:'장기 무역 협정',trade_buy:'장기 무역 협정',alliance:'식량 상호지원 동맹'};
const STATUS={active:'이행 중',completed:'기간 완료',broken:'자발적 파기',cancelled:'상대국 종료',rejected:'체결 거절'};
const EVENT_LABEL={formed:'새 협정',accepted:'새 협정',fulfilled:'약속 이행',breach:'약속 불이행',standby:'동맹 대기',suspended:'제재로 이행 중지',completed:'기간 완료',broken:'협정 파기',cancelled:'협정 종료',rejected:'체결 거절',market:'내 나라 무역 영향'};

const countryName=id=>COUNTRIES[id]?.name??'알 수 없는 나라';
const asList=value=>Array.isArray(value)?value:[];
const finite=value=>Number.isFinite(Number(value));
const foreignOnly=(state,treaty)=>COUNTRY_IDS.includes(treaty?.playerId)&&COUNTRY_IDS.includes(treaty?.targetId)&&treaty.playerId!==state.playerId&&treaty.targetId!==state.playerId&&treaty.playerId!==treaty.targetId;
const treaties=state=>asList(state?.foreignTreaties).filter(item=>foreignOnly(state,item));
const recentEvents=state=>asList(state?.lastForeignEvents).filter(item=>item&&typeof item==='object');

function impactObject(event){
 const value=event.playerImpact??event.marketImpact;
 return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
}

function impactText(event){
 const direct=event.playerImpact??event.marketImpact;
 if(typeof direct==='string'&&direct.trim())return direct.trim();
 const impact=impactObject(event);
 if(!impact){
  if(event.type==='standby')return '지원 발동 없음 · 내 자원은 직접 이동하지 않았습니다';
  return '상대국을 고르면 달라진 협상 조건을 확인할 수 있습니다';
 }
 if(typeof impact.text==='string'&&impact.text.trim())return impact.text.trim();
 if(typeof impact.summary==='string'&&impact.summary.trim())return impact.summary.trim();
 const parts=[];
 const fields=[
  ['availableFoodDelta','가용 식량',''],['reservedFoodDelta','거래 가능 식량',''],
  ['food','식량',''],['treasury','국고','억'],
  ['importCostDelta','수입 비용','억'],['exportIncomeDelta','수출 수입','억'],
  ['priceDelta','거래 가격','억'],['scoreDelta','협상 반응','점'],
  ['negotiationDelta','협상 반응','점'],['relationDelta','양국 관계','점'],
 ];
 for(const [key,label,unit] of fields)if(finite(impact[key])&&Number(impact[key])!==0)parts.push(`${label} ${signed(Math.round(Number(impact[key])))}${unit}`);
 return parts.length?parts.join(' · '):'상대국을 고르면 달라진 협상 조건을 확인할 수 있습니다';
}

function eventTitle(event){
 if(typeof event.title==='string'&&event.title.trim())return event.title.trim();
 const first=countryName(event.playerId??event.countryId),second=countryName(event.targetId);
 return event.targetId?`${first} · ${second}`:first;
}

function eventCard(event){
 const text=event.text??event.description??'두 나라의 외교 관계가 바뀌었습니다.';
 const type=EVENT_LABEL[event.type]??'외교 변화';
 return `<article class="network-news-item"><div class="network-news-heading"><strong>${escape(eventTitle(event))}</strong><span>${escape(type)}</span></div><p>${escape(text)}</p><p class="network-player-impact"><span>내 나라 영향</span><b>${escape(impactText(event))}</b></p></article>`;
}

function termText(treaty){
 const food=Math.max(0,Math.round(Number(treaty.food)||0)),money=Math.max(0,Math.round(Number(treaty.money)||0));
 if(treaty.kind==='alliance')return `위기 시 상호 식량 최대 ${food}${money?` · 지원금 최대 ${money}억`:''}`;
 const seller=treaty.kind==='trade_buy'?treaty.targetId:treaty.playerId,buyer=seller===treaty.playerId?treaty.targetId:treaty.playerId;
 return `매 분기 ${countryName(seller)} → ${countryName(buyer)} 식량 ${food} · 대금 ${money}억`;
}

function remainingText(state,treaty){
 if(treaty.status!=='active')return STATUS[treaty.status]??'종료';
 const end=Number(treaty.endTurn),start=Number(treaty.startTurn),current=Number(state.turn)||0,duration=Math.max(0,Math.round(Number(treaty.duration)||0));
 if(treaty.lastOutcome?.type==='formed')return `${duration}회 남음`;
 if(!Number.isFinite(end))return '이행 중';
 const remaining=current<start?end-start:end-current-1;
 return `${Math.max(0,remaining)}회 남음`;
}

function treatyCard(state,treaty){
 const outcome=typeof treaty.lastOutcome==='string'?treaty.lastOutcome:treaty.lastOutcome?.text??treaty.events?.at?.(-1)?.text;
 return `<article class="foreign-treaty-card" data-status="${escape(treaty.status??'record')}"><div class="foreign-treaty-top"><div><span>${escape(countryName(treaty.playerId))} · ${escape(countryName(treaty.targetId))}</span><h3>${escape(KINDS[treaty.kind]??'국가 간 협정')}</h3></div><strong>${escape(remainingText(state,treaty))}</strong></div><p class="foreign-treaty-terms">${escape(termText(treaty))}</p><dl><div><dt>약정 기간</dt><dd>${Math.max(0,Math.round(Number(treaty.duration)||0))}분기</dd></div><div><dt>이행</dt><dd>${Math.max(0,Math.round(Number(treaty.fulfilled)||0))}회</dd></div><div><dt>불이행</dt><dd>${Math.max(0,Math.round(Number(treaty.breaches)||0))}회</dd></div></dl>${outcome?`<p class="foreign-treaty-outcome"><span>최근 실제 기록</span>${escape(outcome)}</p>`:'<p class="foreign-treaty-outcome"><span>최근 실제 기록</span>아직 첫 이행 전입니다.</p>'}</article>`;
}

export function renderNetworkBrief(state){
 const events=recentEvents(state).slice(-2).toReversed(),summary=foreignMarketSummary(state);
 const heading=events.length?'국경 너머의 움직임':'다음 분기의 세계';
 const body=events.length?events.map(eventCard).join(''):`<div class="network-quiet"><p>결정을 실행하면 다른 나라들도 교역 상대와 동맹을 찾기 시작합니다.</p></div>`;
 return `<section class="network-brief" aria-labelledby="network-brief-title"><div class="network-brief-title"><div><span class="eyebrow">세계에서 들려온 소식</span><h2 id="network-brief-title">${heading}</h2></div><span class="network-active-count">유효한 타국 협정 ${summary.activeCount}건</span></div><div class="network-news-list">${body}</div></section>`;
}

export function renderForeignNetwork(state){
 const list=treaties(state),active=list.filter(item=>item.status==='active'),past=list.filter(item=>item.status!=='active').slice(-8).toReversed(),events=recentEvents(state).slice(-8).toReversed(),summary=foreignMarketSummary(state);
 const treasuryImpact=summary.playerTreasuryDelta===0?'변화 없음':`${signed(summary.playerTreasuryDelta)}억`;
 return `<section class="foreign-network" aria-labelledby="foreign-network-title"><div class="foreign-network-heading"><div><span class="eyebrow">국가 간 협정망</span><h2 id="foreign-network-title">다른 나라들도 약속을 맺고 지킵니다</h2></div><p>식량과 대금이 실제로 오간 기록만 이행으로 셉니다. 부족과 파기는 관계와 다음 협상 조건에 남습니다.</p></div><dl class="network-totals"><div><dt>이행 중</dt><dd>${summary.activeCount}건</dd></div><div><dt>고정 무역 공급</dt><dd>분기당 ${active.filter(item=>item.kind!=='alliance').reduce((sum,item)=>sum+item.food,0)}</dd></div><div><dt>이번 분기 내 국고 영향</dt><dd>${escape(treasuryImpact)}</dd></div></dl>${renderWorldGoals(state)}<div class="network-section-heading"><h3>현재 이행 중 · ${active.length}건</h3><span>내 나라가 참여하지 않은 협정</span></div>${active.length?`<div class="foreign-treaty-list">${active.map(item=>treatyCard(state,item)).join('')}</div>`:`<div class="network-quiet"><strong>현재 이행 중인 타국 협정이 없습니다.</strong><p>각국이 교역 상대와 동맹을 찾고 있습니다. 재고와 관계가 맞으면 새 협정이 체결됩니다.</p></div>`}<details class="network-history"><summary>최근 체결·이행·파기 기록 보기</summary>${events.length?`<div class="network-news-list">${events.map(eventCard).join('')}</div>`:'<p class="network-history-empty">아직 기록된 외교 변화가 없습니다.</p>'}${past.length?`<div class="network-section-heading network-past-heading"><h3>종료된 협정</h3><span>최근 ${past.length}건</span></div><div class="foreign-treaty-list">${past.map(item=>treatyCard(state,item)).join('')}</div>`:''}</details></section>`;
}

import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';
import {foreignGoalView} from './foreign-goals.mjs?v=29';
import {goalRelations} from './goal-relations.mjs?v=29';
import {escape} from './render.mjs?v=29';
import {renderForeignStrategy} from './foreign-strategy-ui.mjs?v=29';

const foreignIds=state=>COUNTRY_IDS.filter(id=>id!==state?.playerId);
const activated=state=>Number.isSafeInteger(state?.worldGoalStartTurn)&&state.turn>=state.worldGoalStartTurn;
const actorFor=(state,id)=>state?.foreignGoals?.[id]??null;
const signed=value=>`${value>0?'+':value<0?'−':'±'}${Math.abs(value)}`;

function requirementRows(view){
 return view.requirements.map(item=>`<li class="${item.met?'is-met':''}"><span>${escape(item.label)}</span><b>${item.current}/${item.target}</b></li>`).join('');
}

function activationNote(state){
 if(!Number.isSafeInteger(state?.worldGoalStartTurn))return '기존 기록은 다음 분기부터 타국 목표 행동을 집계합니다.';
 return `${state.worldGoalStartTurn}분기부터 집계 · 첫 목표 행동을 기다리는 중`;
}

export function renderForeignGoalIntel(state,id){
 if(!state?.countries||!COUNTRY_IDS.includes(id)||id===state.playerId)return '';
 const actor=actorFor(state,id),view=foreignGoalView(state,id);
 if(!view)return `<section class="foreign-goal-intent is-pending" data-foreign-goal="${id}"><span>국가 장기 목표</span><strong>목표 기록 준비 중</strong><p>${activationNote(state)}</p></section>`;
 const last=actor?.lastAction;
 const completed=view.completed.length;
 const lastAction=last&&last.turn>=state.worldGoalStartTurn
  ? `<p class="foreign-goal-last"><span>최근 실제 행동 · ${last.turn}분기</span><strong>${escape(last.name)}</strong><small>${escape(last.reason)}</small></p>`
  : `<p class="foreign-goal-last is-pending"><span>최근 실제 행동</span><strong>${activated(state)?'이번 분기 행동 집계 중':'첫 분기 행동 대기'}</strong><small>${activationNote(state)}</small></p>`;
 return `<section class="foreign-goal-intent" data-foreign-goal="${id}" data-goal-stage="${view.stage}"><header><span>국가 장기 목표 · ${completed}/3 달성</span><strong>${escape(view.title)}</strong></header><p class="foreign-goal-stage">${view.done?'장기 목표 달성':`${view.stage}단계 · ${escape(view.stageTitle)}`}</p>${renderForeignStrategy(state,id)}<details><summary>현재 조건과 실행 근거</summary><ul>${requirementRows(view)}</ul>${lastAction}</details></section>`;
}

function goalRow(state,id){
 const view=foreignGoalView(state,id),actor=actorFor(state,id);
 if(!view)return `<article class="world-goal-row" data-world-goal="${id}"><div><span>${escape(COUNTRIES[id].name)}</span><strong>목표 기록 준비 중</strong></div><p>${activationNote(state)}</p></article>`;
 const last=actor?.lastAction;
 return `<article class="world-goal-row" data-world-goal="${id}"><div><span>${escape(COUNTRIES[id].name)} · ${view.completed.length}/3 달성</span><strong>${escape(view.title)}</strong></div><p>${view.done?'장기 목표 달성':`${view.stage}단계 · ${escape(view.stageTitle)}`}</p>${renderForeignStrategy(state,id)}<details><summary>조건과 최근 행동</summary><ul>${requirementRows(view)}</ul>${last&&last.turn>=state.worldGoalStartTurn?`<p><b>${last.turn}분기 · ${escape(last.name)}</b><br>${escape(last.reason)}</p>`:`<p>${activationNote(state)}</p>`}</details></article>`;
}

function relationRow(item){
 const label=item.type==='competition'?'목표 경쟁':'목표 협력';
 return `<li data-goal-relation="${escape(item.type)}"><span>${escape(COUNTRIES[item.countryId]?.name??item.countryId)} · ${escape(COUNTRIES[item.targetId]?.name??item.targetId)}</span><strong>${escape(label)} · ${escape(item.title)}</strong><p>${escape(item.reason)}</p></li>`;
}

function dispatchRows(state){
 const actions=(state?.history?.at(-1)?.worldActions??[]).filter(item=>item?.source==='national_goal');
 if(!actions.length)return '<p class="world-goals-empty">이번 분기에는 기록된 타국 목표 행동이 없습니다.</p>';
 return `<ul class="world-goal-dispatch">${actions.map(item=>`<li data-goal-action="${escape(item.type??'action')}"><span>${escape(COUNTRIES[item.actorId??item.countryId]?.name??'국제사회')}</span><p>${escape(item.text)}</p></li>`).join('')}</ul>`;
}

export function renderWorldGoals(state){
 const rows=foreignIds(state).map(id=>goalRow(state,id)).join('');
 const relations=goalRelations(state);
 const relationMarkup=relations.length?`<ul class="world-goal-relations">${relations.map(relationRow).join('')}</ul>`:'<p class="world-goals-empty">현재 장기 목표가 직접 맞물린 국가 관계는 없습니다.</p>';
 return `<section class="world-goals" aria-labelledby="world-goals-title"><div class="world-goals-heading"><span class="eyebrow">각국의 국가 목표</span><h3 id="world-goals-title">다섯 나라는 목적을 따라 움직입니다</h3></div><div class="world-goal-list">${rows}</div><details class="world-goal-quarter"><summary>이번 분기 목표 행동과 달성 기록</summary>${dispatchRows(state)}</details><details class="world-goal-relations-detail"><summary>목표가 겹치는 관계 ${relations.length}건</summary>${relationMarkup}</details></section>`;
}

function materialEvent(state,event){
 const impact=event?.playerImpact;
 if(!impact||typeof impact!=='object')return false;
 const numeric=['food','treasury','relationDelta','scoreDelta'].some(key=>Number.isFinite(Number(impact[key]))&&Number(impact[key])!==0);
 const proposal=event.type==='cooperation'&&[event.countryId,event.targetId].includes(state.playerId);
 const explicit=event.actualOwnImpact===true||impact.actualOwnImpact===true;
 return numeric||proposal||explicit;
}

function impactText(impact){
 const parts=[];
 if(Number(impact.food))parts.push(`식량 ${signed(Number(impact.food))}`);
 if(Number(impact.treasury))parts.push(`국고 ${signed(Number(impact.treasury))}억`);
 if(Number(impact.relationDelta))parts.push(`관계 ${signed(Number(impact.relationDelta))}점`);
 if(Number(impact.scoreDelta))parts.push(`협상 반응 ${signed(Number(impact.scoreDelta))}점`);
 return parts.join(' · ')||impact.text||'새 협력 제안이 도착했습니다.';
}

function consequenceRow(event){
 const actor=COUNTRIES[event.countryId]?.name??event.countryId;
 const target=COUNTRIES[event.targetId]?.name??event.targetId;
 const actual=event.text?`<small>${escape(event.text)}</small>`:'';
 const title=event.type==='competition'?'같은 구매국을 두고 수출 경쟁':event.title;
 const reason=event.type==='proposal'?'':`<p>${escape(event.reason)}</p>`;
 return `<article class="goal-consequence" data-goal-event="${escape(event.type)}"><span>${escape(actor)} · ${escape(target)}</span><strong>${escape(title)}</strong>${reason}${actual}<b>${escape(impactText(event.playerImpact))}</b></article>`;
}

export function renderGoalConsequences(state){
 const proposals=(state?.requests??[]).filter(request=>request?.status==='pending'&&request.createdTurn===state.turn&&request.goalTitle).map(request=>{
  const terms=request.terms??{},food=Number(terms.food)||0,money=Number(terms.treasury)||0,duration=Number(terms.duration)||0;
  const termsText=request.type==='trade'?`${duration}분기 · 매 분기 식량 +${food} / 국고 −${Math.ceil(money/Math.max(1,duration))}억`:request.type==='technology'?`연구비 ${money}억 · ${duration}분기 동안 생산 +${food}`:`지원 요청 · 식량 ${food} / 국고 ${money}억`;
  return {type:'proposal',countryId:request.fromId,targetId:state.playerId,title:request.title,reason:request.goalReason,text:termsText,playerImpact:{text:'검토 대기 · 수락 전 자원 이동 없음'}};
 });
 const events=[...proposals,...(state?.lastGoalEvents??[]).filter(event=>materialEvent(state,event))];
 if(!events.length)return '';
 const prominent=events.slice(0,3),more=events.slice(3);
 return `<section class="goal-consequences" aria-labelledby="goal-consequences-title"><div class="goal-consequences-heading"><span>내 운영에 닿은 타국 목표</span><h3 id="goal-consequences-title">이번 분기 목표 파급과 제안</h3></div><div>${prominent.map(consequenceRow).join('')}</div>${more.length?`<details><summary>나머지 파급 ${more.length}건</summary><div>${more.map(consequenceRow).join('')}</div></details>`:''}</section>`;
}

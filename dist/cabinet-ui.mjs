import {cabinetPlanFacts} from './cabinet-agendas.mjs?v=30';
import {quarterDate} from './calendar.mjs?v=30';
import {escape} from './render.mjs?v=30';

const LABELS={food:'식량',treasury:'국고',price:'물가',trust:'신뢰',approval:'지지도'};
const number=value=>value<0?`−${Math.abs(value)}`:`+${value}`;
const period=turn=>{const date=quarterDate(turn-1);return `${date.year}년 ${date.quarter}분기`;};
const changes=effects=>Object.entries(LABELS).filter(([key])=>effects[key]).map(([key,label])=>`${label} ${number(effects[key])}${key==='treasury'?'억':''}`).join(' · ');
const favorable=(key,value)=>key==='price'?value<0:value>0;

export function cabinetTerms(state,action){
 const immediate=action.immediate,positive=Object.fromEntries(Object.entries(immediate).filter(([key,value])=>favorable(key,value)));
 const negative=Object.fromEntries(Object.entries(immediate).filter(([key,value])=>!favorable(key,value)));
 const future=`${period(state.turn+2)}부터 ${action.plan.duration}회 · 매 분기 ${changes(action.effects)}`;
 const cost=[action.cost?`국고 ${action.cost}억`:null,action.foodCost?`식량 ${action.foodCost}`:null,changes(negative)].filter(Boolean).join(' · ');
 return {gain:[changes(positive),future].filter(Boolean).join(' · '),sacrifice:cost?`지금 ${cost}`:'즉시 자원 지출 없음'};
}

export function cabinetResult(state,last){
 const event=(last.worldActions??[]).find(item=>item.source==='cabinet'&&item.operation==='decision'&&item.originatingTurn===last.turn);
 if(!event)return null;
 return {label:last.actionLabel,actualCost:last.actionCost,actualFood:Math.max(0,-event.food),costLabel:'실제 지출',outcome:'국정 조치 시행 · 후속 일정 확정',timing:`${period(event.plan.startTurn)}부터 ${event.plan.duration}회 · 매 분기 ${changes(event.plan.effects)} · ${period(event.plan.endTurn)} 종료`};
}

export function renderCabinetFollowthrough(state,phase='result'){
 const events=phase==='result'?(state.history.at(-1)?.worldActions??[]).filter(item=>item.source==='cabinet'&&item.operation==='followthrough'):[];
 const pending=cabinetPlanFacts(state).filter(plan=>phase==='decision'||plan.originatingTurn<state.turn);
 if(!events.length&&!pending.length)return '';
 const applied=events.map(event=>`<li><strong>${escape(event.originatingName)}</strong><small>${period(event.originatingTurn)} 결정 → 이번 분기 후속 조치</small><b>${escape(changes(event.effects)||'보유 한도에 도달 · 추가 반영 없음')}</b></li>`).join('');
 const future=pending.map(plan=>`<li><strong>${escape(plan.name)}</strong><small>${escape(plan.nextLabel)}부터 남은 ${plan.remaining}회 · ${escape(plan.endLabel)} 종료</small><span>예정 · 매 분기 ${escape(changes(plan.effects))}</span></li>`).join('');
 const content=`${applied?`<ul>${applied}</ul>`:''}${future?`<h4>예정된 후속 효과</h4><ul>${future}</ul><small>보유 한도 안에서 반영됩니다.</small>`:''}`;
 if(phase==='decision')return `<details class="cabinet-followthrough"><summary>예정된 후속 효과 ${pending.length}건</summary>${content}</details>`;
 return `<section class="cabinet-followthrough" aria-label="이전 결정에서 이어진 효과"><h3>이전 결정이 만든 이번 변화</h3>${content}</section>`;
}

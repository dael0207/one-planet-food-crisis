import {getAction} from './engine.mjs?v=29';
import {getDomesticOrders} from './scenarios.mjs?v=29';
import {escape} from './render.mjs?v=29';
import {policyTradeoffs} from './policy-tradeoffs.mjs?v=29';

function orderRow(state,option,selected,index){
 const action=getAction(state,option.id),player=state.countries[state.playerId];
 const disabled=!action||action.cost>player.treasury||(action.foodCost??0)>player.food;
 const tradeoff=action?policyTradeoffs(state,action):null;
 const cost=action?.cost?`국고 −${action.cost}억`:'국고 지출 없음';
 return `<label class="policy${selected===option.id?' selected':''}${disabled?' unavailable':''}" data-command-row="${escape(option.id)}"><input type="radio" name="policy" value="${escape(option.id)}"${selected===option.id?' checked':''}${disabled?' disabled':''}><span class="command-index" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="policy-copy"><span class="policy-title"><strong>${escape(option.label??option.name)}</strong><span class="policy-cost">${cost}${disabled?' · 자원 부족':''}</span></span><span class="policy-tradeoffs"><span><b>효과</b><em>${escape(tradeoff?.gain??option.detail??option.description)}</em></span><span><b>대가</b><em>${escape(tradeoff?.sacrifice??'조건을 확인하세요')}</em></span></span></span></label>`;
}

export function renderOrders(state,options,selected,domestic=true){
 const suggested=new Set(options.map(option=>option.id));
 const more=domestic?getDomesticOrders(state).filter(option=>!suggested.has(option.id)):[];
 return `<div id="policies" class="command-list">${options.map((option,index)=>orderRow(state,option,selected,index)).join('')}</div>${more.length?`<details class="additional-orders"${more.some(option=>option.id===selected)?' open':''}><summary>그 밖의 국내 명령 <span>${more.length}개 더 있음</span></summary><div class="command-list">${more.map((option,index)=>orderRow(state,option,selected,index+options.length)).join('')}</div></details>`:''}`;
}

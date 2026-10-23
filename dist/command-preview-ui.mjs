import {getAction} from './engine.mjs?v=31';
import {commandPreview} from './command-preview.mjs?v=33';
import {escape,signed} from './render.mjs?v=31';

const costLine=action=>{
 const costs=[];
 if(action.foodCost)costs.push(`식량 ${action.foodCost}`);
 costs.push(action.cost?`국고 ${action.cost}억`:'국고 지출 없음');
 return `${costs.join(' · ')} · 실행하면 1분기 진행`;
};

export function renderCommandReview(state,command){
 if(!state||typeof command!=='string'||!command)return '';
 const action=getAction(state,command),model=commandPreview(state,command);
 if(!action||!model)return '';
 return `<section class="command-review" data-command-review="${escape(command)}"><div class="decision-kicker"><span>명령 실행 검토</span><span>1분기 명령</span></div><h2 id="decision-title" tabindex="-1">${escape(action.name)}</h2><p class="event-description">${escape(action.description)}</p><p class="command-review-cost">${escape(costLine(action))}</p><div class="command-review-forecast" role="status"><span>${escape(model.notice)}</span><strong>분기 예상</strong>${model.metrics.map(metric=>`<div data-preview-metric="${escape(metric.key)}"><span>${escape(metric.label)}</span><b>${metric.before} → ${metric.after}${metric.key==='treasury'?'억':''}</b><small>유지 대비 ${signed(metric.commandEffect)}</small></div>`).join('')}</div><button type="button" class="text-button command-review-map" data-action="focus-map-preview" data-command-id="${escape(command)}">지도에서 예상 변화 보기 ↑</button><form id="command-review-form" data-command-id="${escape(command)}"><button class="primary-button" type="submit">이 명령 실행 · 1분기 진행 →</button><button class="secondary-button" type="button" data-action="clear-map-preview">선택 취소</button></form><p class="decision-note">예상치는 현재 조건을 기준으로 한 모의계산이며 실제 분기 결과를 보장하지 않습니다.</p></section>`;
}

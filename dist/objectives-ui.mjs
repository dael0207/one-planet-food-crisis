import {getObjectiveView,getObjectivePlan,unlockedPolicies} from './objectives.mjs?v=30';
import {escape} from './render.mjs?v=30';

export function renderObjectiveRail(state){
 const view=getObjectiveView(state),plan=getObjectivePlan(state.playerId);
 const met=view.requirements.filter(item=>item.met).length,total=view.requirements.length;
 const progress=view.done?100:Math.round(met/Math.max(1,total)*100);
 const roadmap=plan.stages.map((stage,index)=>{
  const completed=view.completed.find(item=>item.stage===index+1);
  return `<li${completed?' class="is-complete"':''}><span>${completed?'✓':String(index+1).padStart(2,'0')}</span><div><strong>${escape(stage.title)}</strong><small>${stage.requirements.map(escape).join('<br>')}</small>${completed?`<small>${completed.turn}분기 달성</small>`:''}</div></li>`;
 }).join('');
 const requirements=view.requirements.map(item=>`<li class="${item.met?'is-met':''}"><span aria-hidden="true">${item.met?'✓':'○'}</span>${escape(item.label)} <b>${item.current}/${item.target}</b></li>`).join('');
 const unlock=view.nextUnlock?`달성하면 <strong>${escape(view.nextUnlock.name)}</strong> 개방`:view.done?'3단계 달성 · 세계 운영은 계속됩니다.':'다음 국가 사업 준비';
 const scope=state.objectiveStartTurn>1?` 정책·협정 실행 횟수는 ${state.objectiveStartTurn}분기부터 기록하며, 시설과 재고는 현재 상태로 평가합니다.`:'';
 return `<div class="mandate-heading"><div><span>국가 목표 · ${view.completed.length}/3 달성</span><h2>${escape(view.title)}</h2></div><span class="mandate-stage">${view.done?'목표 달성':`${view.stage}단계`}</span></div><div class="mandate-current"><strong>${escape(view.stageTitle)}</strong><div class="mandate-progress" role="progressbar" aria-label="현재 단계의 달성 조건" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div></div><ul class="mandate-requirements">${requirements}</ul><details class="mandate-roadmap"><summary>${unlock}<span>전체 목표 보기</span></summary><ol>${roadmap}</ol><p>달성한 단계는 유지됩니다. 정책·사건 검토는 시간을 쓰지 않으며, 실행할 때 한 분기가 흐릅니다.${scope}</p></details>`;
}

export function renderObjectiveAchievements(state){
 const achievements=state.history.at(-1)?.objectiveAchievements??[];
 const policies=unlockedPolicies(state);
 if(!achievements.length)return '';
 return `<section class="mandate-achievement" aria-label="이번 분기 국가 목표 달성">${achievements.map(item=>{
  const name=item.unlockName??policies.find(policy=>policy.id===item.unlockId)?.name;
  return `<span>국가 목표 ${item.stage}단계 달성</span><h3>${escape(item.title)}</h3><p>${name?`새 명령 개방 · <strong>${escape(name)}</strong>`:'장기 목표를 모두 달성했습니다. 계속 운영할 수 있습니다.'}</p>${item.stage===2?'<small>다음 현안에서 새로운 국가 사업 사건을 검토할 수 있습니다.</small>':''}`;
 }).join('')}</section>`;
}

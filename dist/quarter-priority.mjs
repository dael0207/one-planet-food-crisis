import {COUNTRIES,PROFILES,SITE_DEFS,getAction} from './engine.mjs?v=29';
import {getObjectiveView,OBJECTIVE_PLANS} from './objectives.mjs?v=29';
import {getScenario} from './scenarios.mjs?v=29';
import {nationalProjects,siteProjects} from './project-state.mjs?v=29';

const safe=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const affordable=(state,commandId)=>{
 const action=getAction(state,commandId),country=state.countries?.[state.playerId];
 return Boolean(action&&country&&country.treasury>=action.cost&&country.food>=(action.foodCost??0));
};
const result=priority=>({
 commandId:null,view:null,countryId:null,siteKind:null,requestId:null,...priority,
});

function urgentResource(state){
 const country=state.countries?.[state.playerId];
 if(!country||country.food>=35&&country.price<=135)return null;
 const commandId=getScenario(state).options.map(option=>option.id).find(id=>affordable(state,id))??null;
 if(!commandId)return null;
 if(country.food<35)return result({kind:'resource',title:'식량 비축을 먼저 지키세요',reason:`현재 식량 ${country.food}. 위험선 35 아래라 장기 목표보다 즉시 공급 대응이 우선입니다.`,actionLabel:'대응 정책 보기',commandId});
 return result({kind:'resource',title:'생활물가를 먼저 낮추세요',reason:`현재 생활물가 ${country.price}. 부담선 135를 넘어 즉시 가격 대응이 우선입니다.`,actionLabel:'대응 정책 보기',commandId});
}

function deadlineCandidates(state){
 const requests=(state.requests??[]).filter(item=>item.fromId!==state.playerId&&item.status==='pending'&&item.expiresTurn>state.turn).map(item=>{
  const commands=['accept','counter','decline'].map(verb=>`${verb}:${item.id}`),commandId=commands.find(id=>affordable(state,id));
  return commandId?{remaining:item.expiresTurn-state.turn,title:`${COUNTRIES[item.fromId]?.name??'외국'} 제안 회신`,reason:`이번 결정을 넘기면 ${item.title}에 회신할 수 없습니다.`,commandId,countryId:item.fromId,requestId:item.id}:null;
 });
 const counters=(state.negotiations??[]).filter(item=>item.status==='countered'&&item.expiresTurn>state.turn).map(item=>{
  const commands=[`reply:${item.id}:accept`,`reply:${item.id}:decline`],commandId=commands.find(id=>affordable(state,id));
  return commandId?{remaining:item.expiresTurn-state.turn,title:`${COUNTRIES[item.targetId]?.name??'외국'} 역제안 회신`,reason:'이번 결정을 넘기면 상대국의 조정 조건이 만료됩니다.',commandId,countryId:item.targetId}:null;
 });
 const mediation=(state.mediations??[]).filter(item=>item.status==='countered').map(item=>{
  const commandId=`mediate-accept:${item.id}`;
  return affordable(state,commandId)?{remaining:item.expiresTurn-state.turn-1,title:'분쟁 중재 역제안 회신',reason:'이번 결정이 현재 중재 조건에 답할 수 있는 마지막 기회입니다.',commandId}:null;
 });
 const peace=(state.peaceOffers??[]).filter(item=>item.status==='pending').map(item=>{
  const commands=[`peace-reply:${item.id}:accept`,`peace-reply:${item.id}:decline`],commandId=commands.find(id=>affordable(state,id));
  return commandId?{remaining:item.expiresTurn-state.turn-1,title:`${COUNTRIES[item.fromId]?.name??'외국'} 평화 제안 회신`,reason:'이번 결정이 도착한 평화 조건에 답할 수 있는 마지막 기회입니다.',commandId,countryId:item.fromId}:null;
 });
 return [...requests,...counters,...mediation,...peace].filter(Boolean).filter(item=>item.remaining===1).sort((a,b)=>a.title.localeCompare(b.title));
}

function urgentDeadline(state){
 const item=deadlineCandidates(state)[0];
 return item?result({kind:'deadline',title:item.title,reason:item.reason,actionLabel:'조건과 회신 검토',commandId:item.commandId,view:'diplomacy',countryId:item.countryId??null,requestId:item.requestId??null}):null;
}

function suspendedSupply(state){
 const contract=(state.jointInvestments??[]).find(item=>item.status==='suspended'&&COUNTRIES[item.targetId]&&['farm','port'].includes(item.kind));
 if(!contract)return null;
 const site=contract.kind==='farm'?'공동 농경지':'공동 항만';
 return result({kind:'supply',title:`${COUNTRIES[contract.targetId].name} ${site} 공급 중단`,reason:contract.lastReason||'공동 투자 공급과 정산이 중단됐습니다.',actionLabel:'중단 원인 확인',view:'map',countryId:contract.targetId,siteKind:contract.kind});
}

function completingConstruction(state){
 const site=siteProjects(state).find(project=>project.dueTurn===state.turn+1&&SITE_DEFS[project.siteKind]);
 if(site)return result({kind:'construction',title:`${SITE_DEFS[site.siteKind].name} 완공 예정`,reason:`다음 결정과 함께 ${SITE_DEFS[site.siteKind].name} ${site.level}단계 공사가 완공됩니다.`,actionLabel:'현장 확인',view:'map',countryId:state.playerId,siteKind:site.siteKind});
 const national=nationalProjects(state).find(project=>project.dueTurn===state.turn+1);
 return national?result({kind:'construction',title:`${PROFILES[state.playerId].facilityName} 완공 예정`,reason:`다음 결정을 실행하면 국가 시설 ${state.farmLevel+1}단계 공사가 완공됩니다.`,actionLabel:'공사 일정 확인',view:'records'}):null;
}

function objectivePolicy(state){
 const view=getObjectiveView(state),plan=OBJECTIVE_PLANS[state.playerId];
 if(!plan||view.done)return null;
 const definition=plan.stages[view.stage-1],unmet=view.requirements.findIndex(item=>!item.met);
 if(unmet<0)return null;
 const requirement=definition.requirements[unmet],progress=view.requirements[unmet];
 const candidates=requirement.kind==='count'?requirement.keys:requirement.kind==='metric'&&requirement.key==='farmLevel'?['invest']:[];
 const commandId=candidates.find(id=>affordable(state,id));
 if(!commandId)return null;
 return result({kind:'objective',title:`${getAction(state,commandId).name} 검토`,reason:`국가 목표 ‘${view.stageTitle}’ · 남은 조건: ${progress.label} ${progress.current}/${progress.target}.`,actionLabel:'조건 보기',commandId});
}

function currentPolicy(state){
 const scenario=getScenario(state),commandId=scenario.options.map(option=>option.id).find(id=>affordable(state,id));
 return result({kind:'policy',title:scenario.title,reason:scenario.description,actionLabel:'정책 선택 보기',commandId});
}

function contextualAgenda(state){
 const scenario=getScenario(state);
 if(!scenario.agenda)return null;
 const commandId=scenario.options.map(option=>option.id).find(id=>id.startsWith('cabinet:')&&affordable(state,id));
 return commandId?result({kind:'agenda',title:scenario.agenda.title,reason:scenario.agenda.origin,actionLabel:'현안 검토',commandId}):null;
}

export function quarterPriority(state){
 return urgentResource(state)??urgentDeadline(state)??suspendedSupply(state)??completingConstruction(state)??contextualAgenda(state)??objectivePolicy(state)??currentPolicy(state);
}

export function renderQuarterPriority(state,phase='decision'){
 if(phase!=='decision')return '';
 const priority=quarterPriority(state);
 return `<section class="quarter-priority" aria-labelledby="quarter-priority-title"><span class="quarter-priority-kicker">이번 분기 우선 과제</span><div><strong id="quarter-priority-title">${safe(priority.title)}</strong><p>${safe(priority.reason)}</p></div><button type="button" class="secondary-button" data-action="inspect-priority">${safe(priority.actionLabel)} <span aria-hidden="true">→</span></button></section>`;
}

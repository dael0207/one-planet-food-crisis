import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';
import {OBJECTIVE_PLANS,OBJECTIVE_POLICIES} from './objectives-data.mjs?v=29';
import {advanceObjectives,createObjectives,getObjectiveView} from './objectives.mjs?v=29';
import {tradeBlocked} from './goal-conflicts.mjs?v=29';

const BASIC={
 lumen:{balanced:{name:'교역 신뢰 강화',cost:4}},
 nord:{secure_imports:{name:'장기 수입선 확보',cost:10,food:8},strategic_reserve:{name:'전략 비축 방출',cost:4}},
 cera:{export_push:{name:'수출 확대',cost:2,food:8}},
 altia:{research:{name:'고수확 종자 연구',cost:15}},
 marin:{expand_routes:{name:'대체 항로 개설',cost:11,food:6},emergency_import:{name:'긴급 선박 수입',cost:9,food:9}},
 solis:{resilience:{name:'가뭄 회복 사업',cost:10}},
};
const clamp=value=>Math.max(0,Math.min(100,Math.round(value)));
const count=(actor,id)=>actor.objectives?.counts?.[id]??0;
const objectParticle=word=>{const code=word.charCodeAt(word.length-1);return code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28?'을':'를';};
const subjectParticle=word=>{const code=word.charCodeAt(word.length-1);return code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28?'이':'가';};

export const goalActorActive=state=>Number.isSafeInteger(state?.worldGoalStartTurn)&&state.turn>=state.worldGoalStartTurn;

export function createForeignGoals(playerId){
 if(!COUNTRY_IDS.includes(playerId))throw new Error('운영 국가가 올바르지 않습니다.');
 return Object.fromEntries(COUNTRY_IDS.filter(id=>id!==playerId).map(id=>[id,{objectives:createObjectives(id),lastAction:null}]));
}

const actorState=(state,id,objectives,events=[])=>({
 ...state,playerId:id,farmLevel:state.countries[id].infrastructure??0,objectiveStartTurn:state.worldGoalStartTurn,
 objectives,lastTreatyEvents:events,
});

export function foreignGoalView(state,id){
 if(!COUNTRY_IDS.includes(id)||id===state.playerId)return null;
 const actor=state.foreignGoals?.[id];
 return actor?getObjectiveView(actorState(state,id,actor.objectives)):null;
}

function transfer(next,sellerId,buyerId,wanted,payment){
 if(!sellerId||!buyerId||sellerId===buyerId||[sellerId,buyerId].includes(next.playerId)||tradeBlocked(next,sellerId,buyerId))return null;
 const seller=next.countries[sellerId],buyer=next.countries[buyerId];
 let food=Math.min(wanted,Math.max(0,seller.food-20),Math.max(0,100-buyer.food));
 while(food>0&&Math.ceil(payment*food/wanted)>Math.min(buyer.treasury,100-seller.treasury))food--;
 if(food<=0)return null;
 const money=Math.ceil(payment*food/wanted);seller.food-=food;seller.treasury+=money;buyer.food+=food;buyer.treasury-=money;
 return {food,money};
}

const richestSeller=(next,buyerId)=>COUNTRY_IDS.filter(id=>id!==buyerId&&id!==next.playerId&&next.countries[id].food>20)
 .sort((a,b)=>next.countries[b].food-next.countries[a].food||(next.foreignStrategies?.[buyerId]?((next.relations?.[[buyerId,b].sort().join(':')]??50)-(next.relations?.[[buyerId,a].sort().join(':')]??50)):0)||a.localeCompare(b))[0];
const neediestBuyer=(next,sellerId)=>COUNTRY_IDS.filter(id=>id!==sellerId&&id!==next.playerId&&next.countries[id].treasury>0&&next.countries[id].food<100)
 .sort((a,b)=>next.countries[a].food-next.countries[b].food||(next.foreignStrategies?.[sellerId]?((next.relations?.[[sellerId,b].sort().join(':')]??50)-(next.relations?.[[sellerId,a].sort().join(':')]??50)):0)||a.localeCompare(b))[0];

function record(next,actor,countryId,id,reason,actions,data={}){
 const name=BASIC[countryId]?.[id]?.name??OBJECTIVE_POLICIES[countryId].find(item=>item.id===id)?.name??({invest:'생산 기반 투자',austerity:'재정 회복',goal_emergency_import:'비상 식량 조달'}[id]??id);
 actor.lastAction={id,name,reason,turn:next.turn};
 actions.push({countryId,actorId:countryId,source:'national_goal',goalTitle:OBJECTIVE_PLANS[countryId].title,reason,text:`${COUNTRIES[countryId].name}: ${name}. ${reason}`,...data});
}

function recover(next,id,actor,actions){
 const country=next.countries[id];country.treasury=clamp(country.treasury+3);country.approval-=1;
 record(next,actor,id,'austerity','목표 사업을 계속할 예산을 마련했습니다.',actions,{type:'austerity'});return 'austerity';
}

function relief(next,id,actor,actions){
 const sellerId=richestSeller(next,id),deal=transfer(next,sellerId,id,5,5);if(!deal)return null;
 const reason=`${COUNTRIES[sellerId].name}에서 비상 식량을 조달했습니다.`;
 record(next,actor,id,'goal_emergency_import',reason,actions,{countryId:sellerId,targetId:id,type:'trade',food:deal.food,money:deal.money,text:`${COUNTRIES[sellerId].name} → ${COUNTRIES[id].name}: 목표 비상 조달 식량 ${deal.food} · 대금 ${deal.money}.`});
 return 'goal_emergency_import';
}

function invest(next,id,actor,actions){
 const country=next.countries[id];if(country.infrastructure>=3||country.treasury<12)return null;
 country.treasury-=12;country.infrastructure++;
 record(next,actor,id,'invest','생산 기반을 확충했습니다. 생산 +2는 다음 분기부터 반영됩니다.',actions,{targetId:id,type:'investment',money:12});return 'invest';
}

function applyGoalPolicy(next,id,actor,policy,actions){
 const country=next.countries[id];if(country.treasury<policy.cost)return null;
 country.treasury-=policy.cost;for(const metric of ['food','price','trust','approval'])country[metric]+=policy.goalEffects[metric]??0;
 record(next,actor,id,policy.id,`${policy.name}${objectParticle(policy.name)} 장기 목표에 따라 실행했습니다.`,actions,{type:'policy',money:policy.cost});return policy.id;
}

function importPolicy(next,id,actor,actionId,actions){
 const policy=BASIC[id][actionId],country=next.countries[id];if(country.treasury<policy.cost)return null;
 const sellerId=richestSeller(next,id),deal=transfer(next,sellerId,id,policy.food,policy.cost);if(!deal)return null;
 country.price-=actionId==='expand_routes'?6:actionId==='secure_imports'?8:0;
 const reason=`${COUNTRIES[sellerId].name}에서 목표 물량을 실제 조달했습니다.`;
 record(next,actor,id,actionId,reason,actions,{countryId:sellerId,targetId:id,type:'trade',food:deal.food,money:deal.money,text:`${COUNTRIES[sellerId].name} → ${COUNTRIES[id].name}: 국가 목표 조달 식량 ${deal.food} · 대금 ${deal.money}.`});return actionId;
}

function exportPolicy(next,id,actor,actions){
 if(next.foreignStrategies?.[id]&&actor.lastAction?.id==='export_push'&&actor.lastAction.turn===next.turn-1)return null;
 const policy=BASIC.cera.export_push,country=next.countries.cera;if(country.treasury<policy.cost||country.food<=20)return null;
 const buyerId=neediestBuyer(next,'cera');if(!buyerId)return null;country.treasury-=policy.cost;
 const deal=transfer(next,'cera',buyerId,policy.food,14);if(!deal){country.treasury+=policy.cost;return null;}
 country.trust+=4;record(next,actor,id,'export_push',`${COUNTRIES[buyerId].name}에 곡물을 판매해 수출 목표를 진전시켰습니다.`,actions,{targetId:buyerId,type:'trade',food:deal.food,money:deal.money});return 'export_push';
}

function ceraAction(next,id,actor,actions){
 const exported=exportPolicy(next,id,actor,actions);if(exported||!next.foreignStrategies?.[id])return exported;
 return invest(next,id,actor,actions)??recover(next,id,actor,actions);
}

function stageOne(next,id,actor,actions){
 const country=next.countries[id];
 if(id==='lumen'){if(!count(actor,'balanced')){if(country.treasury<4)return null;country.treasury-=4;country.trust+=4;record(next,actor,id,'balanced','공급 약속의 신뢰를 높였습니다.',actions,{type:'policy',money:4});return 'balanced';}return invest(next,id,actor,actions);}
 if(id==='nord'){if(!count(actor,'secure_imports'))return importPolicy(next,id,actor,'secure_imports',actions);if(country.treasury<4)return null;country.treasury-=4;country.food+=4;country.price-=18;country.approval+=4;record(next,actor,id,'strategic_reserve','전략 비축을 방출해 식탁을 안정시켰습니다.',actions,{type:'policy',money:4});return 'strategic_reserve';}
 if(id==='cera')return ceraAction(next,id,actor,actions);
 if(id==='altia'){if(count(actor,'research')<2){if(country.treasury<15)return null;country.treasury-=15;country.food+=5;country.trust+=2;record(next,actor,id,'research','연구 성과를 국내 생산에 적용했습니다.',actions,{type:'policy',money:15});return 'research';}return invest(next,id,actor,actions);}
 if(id==='marin')return importPolicy(next,id,actor,count(actor,'expand_routes')?'emergency_import':'expand_routes',actions);
 if(!count(actor,'resilience')){if(country.treasury<10)return null;country.treasury-=10;country.food+=5;country.trust+=2;record(next,actor,id,'resilience','가뭄 회복 사업을 시작했습니다.',actions,{type:'policy',money:10});return 'resilience';}
 return invest(next,id,actor,actions);
}

function repeatAction(next,id,actor,actions){
 const country=next.countries[id];
 if(id==='cera')return ceraAction(next,id,actor,actions);
 if(id==='nord'&&country.food<75)return importPolicy(next,id,actor,'secure_imports',actions)??recover(next,id,actor,actions);
 if(id==='marin'&&country.food<75)return importPolicy(next,id,actor,'expand_routes',actions)??recover(next,id,actor,actions);
 if(['lumen','altia','solis'].includes(id)&&country.infrastructure<3)return invest(next,id,actor,actions)??recover(next,id,actor,actions);
 if(id==='altia')return stageOne(next,id,actor,actions)??recover(next,id,actor,actions);
 if(id==='solis')return applyGoalPolicy(next,id,actor,OBJECTIVE_POLICIES[id][0],actions)??recover(next,id,actor,actions);
 return recover(next,id,actor,actions);
}

function strategyAction(next,id,actor,actions){
 const strategy=next.foreignStrategies?.[id];if(!strategy)return null;
 if(strategy.mode==='fiscal')return recover(next,id,actor,actions);
 if(strategy.mode==='food'&&next.countries[id].food<55)return relief(next,id,actor,actions);
 if(strategy.mode==='resilience'&&next.countries[id].infrastructure<3&&next.countries[id].treasury>=50)return invest(next,id,actor,actions);
 if(strategy.mode==='trade'){
  if(id==='cera')return ceraAction(next,id,actor,actions);
  const importId=id==='nord'?'secure_imports':id==='marin'?'expand_routes':null;
  if(importId&&next.countries[id].food<75&&!(actor.lastAction?.id===importId&&actor.lastAction.turn===next.turn-1))return importPolicy(next,id,actor,importId,actions);
 }
 if(strategy.mode==='development'&&next.countries[id].infrastructure<3&&next.countries[id].treasury>=50)return invest(next,id,actor,actions);
 return null;
}

function chooseAction(next,id,actor,actions){
 const country=next.countries[id],view=foreignGoalView(next,id);if(!view)return null;
 const strategic=strategyAction(next,id,actor,actions);if(strategic)return strategic;
 if(view.done)return next.foreignStrategies?.[id]?repeatAction(next,id,actor,actions):null;
 if(country.food<25){const result=relief(next,id,actor,actions);if(result)return result;}
 const second=OBJECTIVE_POLICIES[id][1],required=view.stage===1?Math.min(...Object.values(BASIC[id]).map(item=>item.cost),12):view.stage===2?OBJECTIVE_POLICIES[id][0].cost:count(actor,second.id)?0:second.cost;
 if(country.treasury<required)return recover(next,id,actor,actions);
 if(view.stage===1)return stageOne(next,id,actor,actions)??(country.treasury<20?recover(next,id,actor,actions):null);
 if(view.stage===2)return applyGoalPolicy(next,id,actor,OBJECTIVE_POLICIES[id][0],actions)??recover(next,id,actor,actions);
 if(!count(actor,second.id))return applyGoalPolicy(next,id,actor,second,actions)??recover(next,id,actor,actions);
 if(['lumen','altia','solis'].includes(id)&&country.infrastructure<2)return invest(next,id,actor,actions)??recover(next,id,actor,actions);
 if(id==='cera'&&(country.treasury<90||country.food<55))return (country.food<55?relief(next,id,actor,actions):ceraAction(next,id,actor,actions))??recover(next,id,actor,actions);
 return null;
}

export function runForeignGoalPolicies(next,before,parts=[],actions=[]){
 if(!goalActorActive(next))return;
 next.foreignGoals??=createForeignGoals(next.playerId);
 for(const id of COUNTRY_IDS.filter(id=>id!==next.playerId)){
  next.foreignGoals[id]??={objectives:createObjectives(id),lastAction:null};chooseAction(next,id,next.foreignGoals[id],actions);
 }
}

const actorEvents=(state,id)=>[
 ...(state.lastTreatyEvents??[]).filter(event=>event?.type==='fulfilled'&&[event.playerId,state.playerId,event.targetId].includes(id)),
 ...(state.lastForeignEvents??[]).filter(event=>event?.type==='fulfilled'&&[event.countryId,event.targetId].includes(id)),
].map(event=>({...event,type:'fulfilled'}));

export function finishForeignGoals(next,before,actions=[]){
 if(!goalActorActive(next)||!next.foreignGoals)return;
 for(const id of COUNTRY_IDS.filter(id=>id!==next.playerId)){
  const actor=next.foreignGoals[id]??{objectives:createObjectives(id),lastAction:null},previous=before.foreignGoals?.[id]?.objectives??createObjectives(id),events=actorEvents(next,id);
  const prior=actorState(before,id,previous,[]),current=actorState(next,id,actor.objectives,events),actionId=actor.lastAction?.turn===next.turn?actor.lastAction.id:null;
  actor.objectives=advanceObjectives(prior,current,actionId);next.foreignGoals[id]=actor;
  for(const item of actor.objectives.completed.filter(item=>item.turn===next.turn&&!previous.completed?.some(old=>old.stage===item.stage)))actions.push({countryId:id,type:'goal_achievement',source:'national_goal',goalTitle:OBJECTIVE_PLANS[id].title,stage:item.stage,text:`${COUNTRIES[id].name}${subjectParticle(COUNTRIES[id].name)} 장기 목표 ${item.stage}단계 ‘${item.title}’${objectParticle(item.title)} 달성했습니다.`});
 }
}

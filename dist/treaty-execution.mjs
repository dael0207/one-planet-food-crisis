import {COUNTRIES} from './country-data.mjs?v=31';
import {completeTreaty,punishBreach,rewardFulfillment,treatyEvent} from './treaty-effects.mjs?v=31';
import {tradeBlocked} from './goal-conflicts.mjs?v=31';

const transfer=(seller,buyer,food,money)=>{
 const stock=Math.min(food,Math.max(0,seller.food-20),Math.max(0,100-buyer.food));let delivered=stock;
 while(delivered>0&&(Math.ceil(money*delivered/food)>buyer.treasury||seller.treasury+Math.ceil(money*delivered/food)>100))delivered--;
 const paid=delivered?Math.ceil(money*delivered/food):0;seller.food-=delivered;seller.treasury+=paid;buyer.food+=delivered;buyer.treasury-=paid;
 return {food:delivered,money:paid};
};
const addPlayerFood=(state,parts,label,fromId,toId,amount)=>{if(!amount)return;if(toId===state.playerId)parts.push({label,value:amount});if(fromId===state.playerId)parts.push({label,value:-amount});};

function executeTrade(state,treaty,parts,actions){
 const sellerId=treaty.kind==='trade_buy'?treaty.targetId:treaty.playerId,buyerId=sellerId===treaty.playerId?treaty.targetId:treaty.playerId;
 if(tradeBlocked(state,sellerId,buyerId)){const text='무역 제재로 '+COUNTRIES[sellerId].name+' → '+COUNTRIES[buyerId].name+' 장기 협정 이행이 중지됐습니다. 불이행으로 기록되지 않습니다.';treatyEvent(state,treaty,'suspended',text,{actorId:null,promisedFood:treaty.food,promisedMoney:treaty.money,food:0,money:0});actions.push({countryId:sellerId,targetId:buyerId,type:'sanction',source:'goal_conflict',text});return;}
 const seller=state.countries[sellerId],buyer=state.countries[buyerId],before={sellerFood:seller.food,sellerCash:seller.treasury,buyerCash:buyer.treasury,buyerCapacity:100-buyer.food},embargo=sellerId===state.playerId&&state.activePolicy==='embargo';
 const result=embargo?{food:0,money:0}:transfer(seller,buyer,treaty.food,treaty.money);addPlayerFood(state,parts,`${COUNTRIES[treaty.targetId].name} 장기 무역 협정`,sellerId,buyerId,result.food);
 if(result.food)actions.push({countryId:sellerId,targetId:buyerId,type:'trade',source:'treaty',text:`장기 협정 이행: ${COUNTRIES[sellerId].name} → ${COUNTRIES[buyerId].name} 식량 ${result.food} · 대금 ${result.money}.`});
 const full=result.food===treaty.food&&result.money===treaty.money;
 if(full&&!embargo){treaty.fulfilled++;treaty.streak=0;const change=rewardFulfillment(state,treaty,sellerId,buyerId),text=`${COUNTRIES[sellerId].name} 측이 식량 ${result.food}, ${COUNTRIES[buyerId].name} 측이 대금 ${result.money} 약속을 모두 이행했습니다.`;treatyEvent(state,treaty,'fulfilled',text,{...change,promisedFood:treaty.food,promisedMoney:treaty.money,food:result.food,money:result.money});return;}
 const sellerBlocked=embargo||before.sellerFood-20<treaty.food||before.sellerCash+treaty.money>100;
 const responsibleId=sellerBlocked?sellerId:before.buyerCash<treaty.money||before.buyerCapacity<treaty.food?buyerId:sellerId;
 treaty.breaches++;treaty.streak++;const change=punishBreach(state,treaty,responsibleId,actions),cause=embargo?'수출 제한으로':`${COUNTRIES[responsibleId].name} 측 사정으로`,text=`${cause} 약속한 식량 ${treaty.food}·대금 ${treaty.money} 중 식량 ${result.food}·대금 ${result.money}만 이행됐습니다.`;
 treatyEvent(state,treaty,'breach',text,{...change,promisedFood:treaty.food,promisedMoney:treaty.money,food:result.food,money:result.money});
 if(treaty.streak>=2){treaty.status='cancelled';treaty.resolvedTurn=state.turn;const cancelText=`${COUNTRIES[responsibleId===treaty.playerId?treaty.targetId:treaty.playerId].name} 측이 2분기 연속 불이행으로 협정을 종료했습니다.`;treatyEvent(state,treaty,'cancelled',cancelText,{actorId:responsibleId});actions.push({countryId:responsibleId,targetId:responsibleId===treaty.playerId?treaty.targetId:treaty.playerId,type:'treaty',source:'treaty',text:cancelText});}
}

function executeAlliance(state,treaty,parts,actions){
 const members=[treaty.playerId,treaty.targetId],needy=members.filter(id=>state.countries[id].food<35).sort((a,b)=>state.countries[a].food-state.countries[b].food);
 if(!needy.length){treaty.streak=0;treatyEvent(state,treaty,'standby','양국 모두 식량 경보선 이상이라 상호 지원 의무가 발동하지 않았습니다.');return;}
 const recipientId=needy[0],donorId=members.find(id=>id!==recipientId),donor=state.countries[donorId],recipient=state.countries[recipientId];
 const promisedFood=treaty.food,promisedMoney=recipient.treasury<25?treaty.money:0,food=Math.min(promisedFood,Math.max(0,donor.food-20),Math.max(0,100-recipient.food)),money=Math.min(promisedMoney,Math.max(0,donor.treasury-20),Math.max(0,100-recipient.treasury));
 donor.food-=food;recipient.food+=food;donor.treasury-=money;recipient.treasury+=money;addPlayerFood(state,parts,`${COUNTRIES[treaty.targetId].name} 상호 지원 동맹`,donorId,recipientId,food);
 if(food||money)actions.push({countryId:donorId,targetId:recipientId,type:'aid',source:'treaty',text:`상호 지원 동맹 발동: ${COUNTRIES[donorId].name} → ${COUNTRIES[recipientId].name} 식량 ${food}${money?` · 지원금 ${money}`:''}.`});
 if(food===promisedFood&&money===promisedMoney){treaty.fulfilled++;treaty.streak=0;const change=rewardFulfillment(state,treaty,donorId),text=`${COUNTRIES[donorId].name} 측이 동맹의 식량 ${food}${money?`·지원금 ${money}`:''} 지원 의무를 이행했습니다.`;treatyEvent(state,treaty,'fulfilled',text,{...change,promisedFood,promisedMoney,food,money});return;}
 treaty.breaches++;treaty.streak++;const change=punishBreach(state,treaty,donorId,actions),text=`${COUNTRIES[donorId].name} 측이 동맹 지원 약속 식량 ${promisedFood}${promisedMoney?`·지원금 ${promisedMoney}`:''} 중 식량 ${food}·지원금 ${money}만 보냈습니다.`;
 treatyEvent(state,treaty,'breach',text,{...change,promisedFood,promisedMoney,food,money});
 if(treaty.streak>=2){treaty.status='cancelled';treaty.resolvedTurn=state.turn;const cancelText=`${COUNTRIES[recipientId].name} 측이 2분기 연속 지원 불이행으로 동맹을 종료했습니다.`;treatyEvent(state,treaty,'cancelled',cancelText,{actorId:donorId});actions.push({countryId:recipientId,targetId:donorId,type:'treaty',source:'treaty',text:cancelText});}
}

export function executeTreaties(state,parts,actions){
 for(const treaty of state.treaties.filter(item=>item.status==='active').sort((a,b)=>a.startTurn-b.startTurn||a.id.localeCompare(b.id))){
  if(state.turn<treaty.startTurn||state.turn>=treaty.endTurn)continue;
  if(treaty.kind==='alliance')executeAlliance(state,treaty,parts,actions);else executeTrade(state,treaty,parts,actions);
  if(treaty.status==='active'&&state.turn===treaty.endTurn-1)completeTreaty(state,treaty,actions);
 }
}

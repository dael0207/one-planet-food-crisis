import {previewProposal} from './negotiations.mjs?v=30';

const change=(before,after)=>({before,after,delta:after-before});

export function proposalComparison(state,currentDraft,previousDraft){
 if(!previousDraft||currentDraft?.targetId!==previousDraft.targetId||currentDraft?.kind!==previousDraft.kind)return null;
 const current=previewProposal(state,currentDraft),previous=previewProposal(state,previousDraft);
 if(!current.valid||!previous.valid)return null;
 const currentFood=Number(currentDraft.food),currentMoney=Number(currentDraft.money);
 const previousFood=Number(previousDraft.food),previousMoney=Number(previousDraft.money);
 return {
  terms:{food:change(previousFood,currentFood),money:change(previousMoney,currentMoney)},
  score:change(previous.score,current.score),
  response:{before:previous.response,after:current.response},
  playerEffect:{
   food:change(previous.playerEffect.food,current.playerEffect.food),
   treasury:change(previous.playerEffect.treasury,current.playerEffect.treasury)
  }
 };
}

export function responseDistance(preview){
 if(preview.response==='accept')return {label:'수락 기준 충족',delta:preview.score-65};
 if(preview.response==='counter')return {label:'수락까지',delta:65-preview.score};
 return {label:'역제안까지',delta:40-preview.score};
}

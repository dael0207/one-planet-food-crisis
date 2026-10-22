import {previewTreaty} from './treaties.mjs?v=29';

const change=(before,after)=>({before,after,delta:after-before});

export function treatyComparison(state,currentDraft,previousDraft){
 if(!previousDraft||currentDraft?.targetId!==previousDraft.targetId||currentDraft?.kind!==previousDraft.kind)return null;
 const current=previewTreaty(state,currentDraft),previous=previewTreaty(state,previousDraft);
 if(!current.valid||!previous.valid)return null;
 return {
  terms:{
   food:change(Number(previousDraft.food),Number(currentDraft.food)),
   money:change(Number(previousDraft.money),Number(currentDraft.money)),
   duration:change(Number(previousDraft.duration),Number(currentDraft.duration))
  },
  score:change(previous.score,current.score),
  response:{before:previous.response,after:current.response}
 };
}

export function treatyResponseDistance(preview){
 return preview.response==='accept'
  ?{label:'수락 기준 충족',delta:preview.score-52}
  :{label:'수락까지',delta:52-preview.score};
}

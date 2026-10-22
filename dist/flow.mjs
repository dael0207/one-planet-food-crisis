export const beginReview=()=>({phase:'result',step:0});
export const canDecide=flow=>flow.phase==='decision';
export function nextReview(flow,turn){
 if(flow.phase!=='result')return flow;
 if(flow.step<3)return {phase:'result',step:flow.step+1};
 return {phase:'decision',step:0};
}

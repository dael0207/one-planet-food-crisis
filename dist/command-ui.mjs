import {escape,signed} from './render.mjs?v=30';
export function renderQuickMetrics(state){
 const current=state.countries[state.playerId],before=state.history.at(-1)?.beforeCountries[state.playerId];
 const specs=[['food','식량',current.food<35?'공급 위기':current.food<60?'여유 부족':'안정'],['treasury','국고','정책에 쓸 예산'],['price','물가',current.price>130?'생활비 부담':'생활비 지수']];
 return specs.map(([key,label,status])=>{
  const delta=before?current[key]-before[key]:0,good=key==='price'?delta<0:delta>0;
  return `<div><span>${label} <small>${escape(status)}</small></span><b>${current[key]}${key==='treasury'?'<small>억</small>':''}</b>${before?`<em class="${delta?(good?'positive':'negative'):''}">${signed(delta)}</em>`:''}</div>`;
 }).join('');
}

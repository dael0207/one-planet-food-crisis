export function jointConstructionBenefit(state,contract){
 if(!contract)return '';
 const site=state.foreignSites?.[contract.targetId]?.[contract.kind];
 const level=site?.project?.level??site?.level??0;
 const maximum=Math.ceil(level*(contract.kind==='farm'?3:2)*contract.share/100);
 const output=contract.kind==='farm'?'식량':'순운영 수익';
 return `우리 몫 ${contract.share}% · 착공 단계 기준 ${output} 분기 최대 ${maximum}${contract.kind==='port'?'억':''} · 실제 생산·재고·관계·제재에 따라 변동·중단`;
}

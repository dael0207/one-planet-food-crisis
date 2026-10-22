import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';
import {routeGeometry} from './map-geometry.mjs?v=29';
import {peaceResponsePairs,peaceResponseMarketContext} from './peace-response-model.mjs?v=29';
import {escape} from './render.mjs?v=29';

const name=id=>COUNTRIES[id]?.name??'';
const effective=(state,phase)=>({...state,turn:state.turn+(phase==='decision'?1:0),peaceResponseForecastTurn:state.turn+(phase==='decision'?1:0)});
const label=link=>`${name(link.fromId)} ↔ ${name(link.toId)} 상업 거래 제한 · ${name(link.initiatorId)} 주도 · ${link.startsTurn}–${link.untilTurn-1}분기`;
export const peaceResponseGeometry=link=>routeGeometry(link.fromId,link.toId,[link.fromId,link.toId].sort().join(':')==='cera:lumen'?(link.fromId==='lumen'?108:-108):null);

export function peaceResponseMapLinks(state,phase='decision'){
 const pairs=peaceResponsePairs(effective(state,phase)),unique=new Map();
 for(const pair of pairs){
  const key=[pair.fromId,pair.toId].sort().join(':');
  if(!unique.has(key)||unique.get(key).untilTurn<pair.untilTurn)unique.set(key,pair);
 }
 return [...unique.values()];
}

export function renderPeaceResponseMapKey(state,phase='decision'){
 const links=peaceResponseMapLinks(state,phase);if(!links.length)return '';
 const own=links.filter(item=>[item.fromId,item.toId].includes(state.playerId)),world=effective(state,phase);
 const impacts=COUNTRY_IDS.filter(id=>id!==state.playerId).map(id=>({id,...peaceResponseMarketContext(world,id,'buy')})).filter(item=>item.scoreDelta);
 const ownText=own.length?`우리나라의 직접 제한 ${own.length}개 경로`:'우리나라의 공동 제재 자동 참여 없음';
 return `<details class="map-enforcement-key"><summary>${links.some(link=>link.memberIds.length>1)?'공동':'타국'} 재제재 · 상업 거래 제한 ${links.length}개 경로</summary><p>끊긴 선과 ×는 실제 상업 거래 제한입니다. 인도적 지원은 유지됩니다.</p><ul>${links.map(link=>`<li>${escape(label(link))}<small>${escape(link.reason??'')}</small></li>`).join('')}</ul><p>${escape(ownText)}</p>${impacts.length?`<ul aria-label="우리나라 무역 협상 영향">${impacts.map(item=>`<li>${escape(name(item.id))} 협상 ${item.scoreDelta>0?'+':''}${item.scoreDelta}<small>${escape(item.reasons.join(' '))}</small></li>`).join('')}</ul>`:''}</details>`;
}

const node=(tag,attrs={},text='')=>{
 const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(text)el.textContent=text;return el;
};

export function updatePeaceResponseMap(svg,state,phase='decision'){
 let layer=svg.querySelector('#map-enforcement-layer');
 if(!layer){layer=node('g',{id:'map-enforcement-layer',class:'map-enforcement-layer'});svg.append(layer);}
 layer.replaceChildren();
 for(const link of peaceResponseMapLinks(state,phase)){
  const point=peaceResponseGeometry(link);if(!point)continue;
  const group=node('g',{'data-enforcement-from':link.fromId,'data-enforcement-to':link.toId,role:'img','aria-label':label(link)});
  group.append(node('title',{},label(link)),node('path',{d:point.d,class:'map-enforcement-path'}));
  const mark=node('g',{transform:`translate(${point.x} ${point.y})`});
  mark.append(node('circle',{r:12}),node('path',{d:'M-5-5 5 5M5-5-5 5',class:'map-enforcement-cross'}));group.append(mark);layer.append(group);
 }
 const target=document.querySelector('#map-enforcement-summary');if(target){target.innerHTML=renderPeaceResponseMapKey(state,phase);target.hidden=!target.innerHTML;}
}

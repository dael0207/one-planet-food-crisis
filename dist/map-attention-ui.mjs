import {mapAttention} from './map-attention.mjs?v=31';
import {GEOGRAPHY} from './map-geometry.mjs?v=31';
import {sitePoint} from './map-sites.mjs?v=31';
import {escape,signed} from './render.mjs?v=31';

const NS='http://www.w3.org/2000/svg';
const ICONS={alert:'M12 3 2 21h20L12 3Zm0 6v5m0 3v1',build:'m4 20 10-10m-5-6 3-2 10 10-2 3-5-5-3 3-5-5 3-3-1-1Z',check:'m4 12 5 5L20 6',reply:'M4 5h16v12H9l-5 4V5Zm4 4h8m-8 4h5',arrow:'M4 12h16m-6-6 6 6-6 6'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]??ICONS.arrow}"/></svg>`;
const attributes=pin=>`data-action="${escape(pin.action)}"${pin.changeId?` data-change-id="${escape(pin.changeId)}"`:''}`;

export function renderMapPin(pin){
 return `<button type="button" class="map-attention-pin" data-signal-id="${escape(pin.id)}" data-tone="${escape(pin.tone)}" ${attributes(pin)} aria-label="${escape(pin.label)} · ${escape(pin.value)} · ${pin.action==='inspect-priority'?'대응 검토':'결과 확인'}">${icon(pin.icon)}<span><strong>${escape(pin.label)}</strong><b>${escape(pin.value)}</b></span></button>`;
}

export function renderMapAttentionHeader(model){
 if(!model?.heading)return '';
 if(model.mode==='decision'){
  const pin=model.pins[0];
  return `<button type="button" class="map-attention-task" data-tone="${escape(pin?.tone??'neutral')}" data-action="inspect-priority">${icon(pin?.icon)}<span><small>지금 해결</small><strong>${escape(model.heading)}</strong></span><b>대응 검토 →</b></button>`;
 }
 return `<div class="map-attention-result"><div><small>명령 완료</small><strong>${escape(model.heading)}</strong></div><button type="button" class="text-button" data-action="focus-order">결과 보기 ↗</button></div><div class="map-attention-totals"><span>분기 총변화</span>${model.metrics.map(metric=>`<div data-total="${metric.key}"><span>${escape(metric.label)}</span><b>${metric.before} → ${metric.after}${metric.key==='treasury'?'억':''}</b><strong data-tone="${metric.delta<0?'danger':metric.delta>0?'positive':'neutral'}">${signed(metric.delta)}</strong></div>`).join('')}</div>`;
}

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const overlaps=(a,b,as,bs)=>a.left< b.left+bs.width+8&&a.left+as.width+8>b.left&&a.top<b.top+bs.height+8&&a.top+as.height+8>b.top;

export function layoutMapPins(anchors,box,sizes){
 const placed=[];
 for(const [index,anchor] of anchors.entries()){
  const size=sizes[index],hidden=box.width<=0||box.height<=0||anchor.x<0||anchor.y<0||anchor.x>box.width||anchor.y>box.height;
  let left=anchors.length===1?clamp(anchor.x-size.width/2,8,box.width-size.width-8):index===0?8:box.width-size.width-8;
  let top=8;
  for(let prior=0;prior<placed.length;prior++){
   if(hidden||placed[prior].hidden||!overlaps({left,top},placed[prior],size,sizes[prior]))continue;
   const above=placed[prior].top-size.height-8,below=placed[prior].top+sizes[prior].height+8;
   top=above>=8?above:clamp(below,8,box.height-size.height-8);
  }
  placed.push({left,top,hidden,anchorX:anchor.x,anchorY:anchor.y});
 }
 return placed;
}

export function createMapAttention(svg,header,layer){
 let model={pins:[]};
 const container=svg.closest('.map-container');
 function place(){
  const matrix=svg.getScreenCTM(),rect=container.getBoundingClientRect();
  if(!matrix||!rect.width||!rect.height)return;
  const buttons=[...layer.querySelectorAll('.map-attention-pin')];
  const anchors=model.pins.map(pin=>{
   const country=GEOGRAPHY[pin.countryId],point=pin.siteKind?sitePoint(pin.countryId,pin.siteKind):{x:country.x,y:country.y+46};
   return {x:point.x*matrix.a+point.y*matrix.c+matrix.e-rect.left,y:point.x*matrix.b+point.y*matrix.d+matrix.f-rect.top};
  });
  for(const button of buttons)button.hidden=false;
  const sizes=buttons.map(button=>({width:button.offsetWidth,height:button.offsetHeight}));
  const positions=layoutMapPins(anchors,{width:rect.width,height:rect.height},sizes);
  const leaders=layer.querySelector('svg');leaders.replaceChildren();
  for(const [index,position] of positions.entries()){
   const button=buttons[index];button.hidden=position.hidden;
   button.style.left=`${position.left}px`;button.style.top=`${position.top}px`;
   if(position.hidden)continue;
   const line=document.createElementNS(NS,'line');
   for(const [key,value] of Object.entries({x1:position.anchorX,y1:position.anchorY,x2:position.left+sizes[index].width/2,y2:position.top+sizes[index].height/2}))line.setAttribute(key,String(value));
   line.dataset.tone=model.pins[index].tone;leaders.append(line);
   const dot=document.createElementNS(NS,'circle');dot.setAttribute('cx',String(position.anchorX));dot.setAttribute('cy',String(position.anchorY));dot.setAttribute('r','3');dot.dataset.tone=model.pins[index].tone;leaders.append(dot);
  }
 }
 const resize=new ResizeObserver(place);resize.observe(svg);
 const camera=new MutationObserver(place);camera.observe(svg,{attributes:true,attributeFilter:['viewBox']});
 return {update(state,phase){
  model=mapAttention(state,phase)??{pins:[],heading:'',mode:phase};
  header.innerHTML=renderMapAttentionHeader(model);
  header.hidden=!model.heading;
  layer.innerHTML=`<svg class="map-attention-leaders" aria-hidden="true"></svg>${model.pins.map(renderMapPin).join('')}`;
  svg.dataset.attention=model.mode;
  for(const country of svg.querySelectorAll('[data-map-attention]'))country.removeAttribute('data-map-attention');
  for(const pin of model.pins){
   const country=svg.querySelector(`.land[data-country="${pin.countryId}"]`);
   if(country)country.dataset.mapAttention=pin.tone;
  }
  place();
 },place};
}

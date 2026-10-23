import {SITE_KINDS,siteView} from './site-operations.mjs?v=31';
import {updateMapSites} from './map-sites.mjs?v=31';
import {createMapCamera} from './map-camera.mjs?v=31';
import {renderSiteSelector,renderSitePanel,siteOrder} from './site-ui.mjs?v=31';
import {jointCommand,previewJointInvestment} from './joint-investments.mjs?v=31';
import {renderJointPreview} from './joint-investments-ui.mjs?v=31';

export function createSiteController(context){
 let selection=null,operation=null,camera=null,cameraPlayer=context.state().playerId,lastCountry=cameraPlayer;
 let jointDraft=null;
 const clear=()=>{selection=null;operation=null;jointDraft=null;};
 const render=()=>renderSitePanel(context.state(),selection,context.phase(),operation,jointDraft);
 function dispatch(action,data){
  if(action==='open-facility'){
   if(!SITE_KINDS.includes(data.site)||!siteView(context.state(),data.country,data.site))return true;
   context.clearCompeting();selection={countryId:data.country,kind:data.site};operation=null;
   context.select(selection);context.rerender();camera?.focusSite(selection);context.focus();return true;
  }
  if(action==='close-facility'){clear();context.rerender();context.focus();return true;}
  if(action==='open-joint-investment'){
   if(context.phase()!=='decision'||!selection||selection.countryId!==data.country||selection.kind!==data.site)return true;
   const draft={targetId:data.country,kind:data.site,capital:20,share:50,duration:8};
   if(!previewJointInvestment(context.state(),draft).eligible)return true;
   jointDraft=draft;context.rerender();context.focus();return true;
  }
  if(action==='cancel-joint-investment'){jointDraft=null;context.rerender();context.focus();return true;}
  if(action==='site-show-map'){camera?.focusSite(selection);document.querySelector('.map-container').scrollIntoView({block:'center',behavior:'instant'});document.querySelector(`[data-site="${selection.kind}"][data-country="${selection.countryId}"]`)?.focus({preventScroll:true});return true;}
  return false;
 }
 function input(event){
  if(event.target.closest('#joint-form')?.id==='joint-form'){
   if(!jointDraft||context.phase()!=='decision')return true;
   const key=event.target.name;
   if(!['capital','share','duration'].includes(key))return true;
   jointDraft={...jointDraft,[key]:Number(event.target.value)};
   const preview=previewJointInvestment(context.state(),jointDraft);
   document.getElementById('joint-preview').innerHTML=renderJointPreview(context.state(),jointDraft);
   document.getElementById('joint-submit').disabled=!(preview.valid&&preview.eligible&&preview.affordable);
   return true;
  }
  if(!event.target.closest('#site-form'))return false;
  operation=['upgrade','manage'].includes(event.target.value)?event.target.value:null;
  const order=siteOrder(context.state(),selection,context.phase(),operation);
  const button=document.getElementById('site-execute'),status=document.getElementById('site-order-status');
  const available=Boolean(order?.action&&!order.reason);
  button.disabled=!available;
  button.textContent=available?`${order.action.name} 실행 · 1분기 진행 →`:'실행할 명령을 선택하세요';
  status.textContent=available?`${order.action.name} · 국고 −${order.action.cost}억 · 1분기 진행`:order?.reason??'실행할 명령을 선택하세요.';
  status.hidden=false;
  for(const label of document.querySelectorAll('.site-order'))label.classList.toggle('is-selected',label.querySelector('input').value===operation);
  return true;
 }
 function submit(event){
  if(event.target.id==='joint-form'){
   if(!jointDraft||context.phase()!=='decision')return true;
   const preview=previewJointInvestment(context.state(),jointDraft);
   if(preview.valid&&preview.eligible&&preview.affordable)context.commit(jointCommand(jointDraft));
   return true;
  }
  if(event.target.id!=='site-form')return false;
  const order=siteOrder(context.state(),selection,context.phase(),operation);
  if(order?.action&&!order.reason)context.commit(order.command);
  return true;
 }
 function updateMap(svg,country){
  const state=context.state();updateMapSites(svg,state,selection);
  if(!camera)camera=createMapCamera(svg,document.getElementById('map-camera-controls'));
  if(cameraPlayer!==state.playerId){camera.reset();cameraPlayer=state.playerId;}
  if(country!==lastCountry&&!selection&&camera.view.zoom>1)camera.focusCountry(country);lastCountry=country;camera.update();
  document.getElementById('site-selector').innerHTML=renderSiteSelector(state,country,selection);
 }
 return {clear,updateMap,isOpen:()=>Boolean(selection),selection:()=>selection,render,dispatch,input,submit};
}

import {createGame,advanceTurn,getAction,COUNTRY_IDS,COUNTRIES,PROFILES,pendingMediationCounters,pendingPeaceOffers} from './engine.mjs?v=31';
import {loadGame,saveGame,savedCountries} from './storage.mjs?v=31';
import {beginReview,nextReview,canDecide} from './flow.mjs?v=31';
import {getScenario,getDomesticOrders} from './scenarios.mjs?v=31';
import {renderMetrics,renderCountry,renderCountryTabs,renderReport} from './render.mjs?v=31';
import {renderDecision,renderOutcome,renderPhase,renderOngoing} from './experience.mjs?v=31';
import {renderInbox,pendingRequests} from './diplomacy-ui.mjs?v=31';
import {updateMap} from './map.mjs?v=31';
import {countryPicker,countryStartLabel} from './country-picker.mjs?v=31';
import {renderProposal,renderProposalPreview,renderProposalTerms,renderOutbound} from './negotiation-ui.mjs?v=31';
import {proposalCommand} from './negotiations.mjs?v=31';
import {treatyCommand,activeTreaties} from './treaties.mjs?v=31';
import {renderTreatyForm,renderTreatyPreview,renderTreatyTerms,renderTreatyLedger,renderBreakReview} from './treaty-ui.mjs?v=31';
import {renderQuickMetrics} from './command-ui.mjs?v=31';
import {renderNetworkBrief,renderForeignNetwork} from './network-ui.mjs?v=31';
import {buildChronicle} from './chronicle-model.mjs?v=31';
import {renderChronicle,normalizeChronicleOptions} from './chronicle-ui.mjs?v=31';
import {renderCountryIntel,renderMapBrief} from './room-map-ui.mjs?v=31';
import {renderOperatingHorizon,commandTarget} from './operations-ui.mjs?v=31';
import {renderObjectiveRail} from './objectives-ui.mjs?v=31';
import {renderConflictBrief,renderConflictReview,renderConflictWorld} from './conflict-ui.mjs?v=31';
import {activeConflicts,conflictAction} from './goal-conflicts.mjs?v=31';
import {createMediationController} from './mediation-controller.mjs?v=31';
import {pendingPeaceComplianceCount} from './peace-compliance-ui.mjs?v=31';
import {renderHelp} from './help-ui.mjs?v=31';
import {createSiteController} from './site-controller.mjs?v=31';
import {quarterPriority,renderQuarterPriority} from './quarter-priority.mjs?v=31';
import {mapConsequences,renderMapConsequences,updateMapConsequences} from './map-consequences.mjs?v=31';
import {createMapAttention} from './map-attention-ui.mjs?v=31';
const get=id=>document.getElementById(id);
const loaded=loadGame();
let state=loaded.state,flow=loaded.flow,requestId=loaded.requestId,selected=null,country=loaded.state.playerId;
let storageOk=loaded.status!=='unavailable';
let proposalDraft=null,proposalPrevious=null;
let treatyDraft=null,treatyPrevious=null,breakReviewId=null;
let conflictReviewId=null;
let mediation=null,site=null;
let currentView='decision',inspecting=false;
let mapMode='network',mapFilter='all';
let mapAttention=null;
let chronicleOptions={period:12,metric:'food',filter:'all',page:0};
function renderRecords(){
 const model=buildChronicle(state);
 chronicleOptions=normalizeChronicleOptions(model,chronicleOptions);
 get('records-content').innerHTML=renderChronicle(model,chronicleOptions);
}
function focusView(view){
 const panel=get(`${view}-view`);panel.scrollIntoView({block:'start',behavior:'instant'});
 const heading=panel.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
function showView(view,focus=false){
 if(!['decision','diplomacy','world','records'].includes(view))return;
 currentView=view;
 get('situation-room').hidden=!['decision','world'].includes(view);
 get('decision-view').hidden=false;
 for(const name of ['diplomacy','world','records'])get(`${name}-view`).hidden=name!==view;
 for(const button of document.querySelectorAll('.command-nav [data-view]')){if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
 if(view==='records'){
  get('records-content').setAttribute('aria-busy','true');
  get('records-content').innerHTML='<section class="chronicle chronicle-empty"><h2>운영 기록을 불러오고 있습니다.</h2><p>분기별 결정과 결과를 연결합니다.</p></section>';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(currentView!=='records')return;
   try{renderRecords();}catch(error){console.error('운영 기록 재생 실패',error instanceof Error?error.message:'기록 오류');get('records-content').innerHTML='<section class="chronicle chronicle-empty"><h2>운영 기록을 불러오지 못했습니다.</h2><p>진행 중인 게임은 그대로 이어갈 수 있습니다.</p><button class="secondary-button" data-action="show-view" data-view="decision">이번 결정으로 돌아가기</button></section>';}
   get('records-content').removeAttribute('aria-busy');if(focus)focusView(view);
  }));
 }else if(focus)focusView(view);
}
function clearCompetingDrafts(){site?.clear();proposalDraft=null;proposalPrevious=null;treatyDraft=null;treatyPrevious=null;breakReviewId=null;conflictReviewId=null;}
function clearDrafts(){clearCompetingDrafts();mediation?.clear();}
function persist(){storageOk=saveGame(state,flow,requestId);}
function render(){
 const reviewing=flow.phase==='result';
 const player=COUNTRIES[state.playerId];
 get('governed-name').textContent=`${player.name} · ${player.roleLabel}`;
 get('governed-challenge').textContent=PROFILES[state.playerId].challenge;
 get('scenario-subtitle').textContent=`${player.name}의 내일을 결정합니다. ${PROFILES[state.playerId].tagline}`;
 get('metrics').setAttribute('aria-label',`${player.name} 국가 지표`);
 const displayedTurn=reviewing?state.turn:state.turn+1;
 const quarter=Math.max(0,displayedTurn-1);
 get('date').textContent=`${2031+Math.floor(quarter/4)}년 · ${quarter%4+1}분기${reviewing?' 결과':''}`;
 get('turn-number').textContent=String(displayedTurn).padStart(2,'0');
 get('progress-bar').style.width=`${(quarter%4+1)*25}%`;
 get('metrics').innerHTML=renderMetrics(state);
 get('quick-metrics').innerHTML=renderQuickMetrics(state);
 get('phase-rail').innerHTML=renderPhase(state,flow);
 get('ongoing-strip').innerHTML=renderOngoing(state);
 get('operating-horizon').innerHTML=renderOperatingHorizon(state,flow.phase);
 get('mandate-rail').innerHTML=renderObjectiveRail(state);
 get('mission-label').textContent=get('mandate-rail').querySelector('.mandate-current > strong').textContent;
 get('country-tabs').innerHTML=renderCountryTabs(state,country);
 get('country-detail').innerHTML=renderCountry(state,country);
 get('decision-content').innerHTML=site?.isOpen()?site.render():reviewing?renderOutcome(state,flow.step,country):mediation?.isOpen()?mediation.render():conflictReviewId?renderConflictReview(state,conflictReviewId,selected):treatyDraft?renderTreatyForm(state,treatyDraft,treatyPrevious):breakReviewId?renderBreakReview(state,breakReviewId):proposalDraft?renderProposal(state,proposalDraft,proposalPrevious):renderDecision(state,selected,requestId);
 get('quarter-priority').innerHTML=renderQuarterPriority(state,flow.phase);
 get('quarter-priority').hidden=reviewing||Boolean(site?.isOpen()||mediation?.isOpen()||conflictReviewId||treatyDraft||breakReviewId||proposalDraft||requestId);
 get('diplomacy-inbox').innerHTML=renderConflictBrief(state,flow.phase)+renderInbox(state,flow,requestId)+renderOutbound(state,flow)+renderTreatyLedger(state,flow);
 const waiting=pendingRequests(state).length+(state.negotiations??[]).filter(record=>record.status==='countered'&&record.expiresTurn>state.turn).length+pendingMediationCounters(state).length+pendingPeaceOffers(state).length+pendingPeaceComplianceCount(state)+activeConflicts(state).filter(item=>conflictAction(state,`stance:${item.id}:neutral`)).length;
 get('dispatch-count').textContent=waiting?String(waiting):'';
 document.querySelector('.command-nav [data-view="decision"]').textContent='상황실';
 get('network-brief').innerHTML=renderNetworkBrief(state);
 get('foreign-network').innerHTML=renderConflictWorld(state,flow.phase)+renderForeignNetwork(state);
 const dispatchOpen=Boolean(get('conflict-brief').querySelector('details')?.open),brief=renderConflictBrief(state,flow.phase);get('conflict-brief').innerHTML=brief?`<details class="atlas-dispatch" ${dispatchOpen?'open':''}><summary>국제 현안 · 협상과 분쟁 보기</summary>${brief}</details>`:'';
 get('report').innerHTML=renderReport(state);
 document.querySelector('.workspace').classList.toggle('scene-review',reviewing);
 updateMap(state,{...flow,selectedCountry:country,mapMode,mapFilter});
 site.updateMap(document.querySelector('.world-map'),country);
 updateMapConsequences(document.querySelector('.world-map'),state,flow.phase);
 if(!mapAttention)mapAttention=createMapAttention(document.querySelector('.world-map'),get('map-attention-header'),get('map-attention-layer'));
 mapAttention.update(state,flow.phase);
 get('map-consequences').innerHTML=renderMapConsequences(state,flow.phase);
 get('country-intel').hidden=!inspecting;
 get('country-intel').innerHTML=inspecting?renderCountryIntel(state,country,flow.phase):'';
 get('map-brief').innerHTML=renderMapBrief(state,flow.phase);
 get('situation-room').classList.toggle('is-result',reviewing);
 const task=document.createElement('strong');task.textContent=reviewing?state.history.at(-1).actionLabel:getScenario(state,requestId).title;
 get('mobile-command').replaceChildren(task);const jump=document.createElement('button');jump.dataset.action='focus-order';jump.textContent=reviewing?'결과 보기 ↓':state.turn?'이번 명령 고르기 ↓':'첫 명령 고르기 ↓';get('mobile-command').append(jump);
 get('save-status').hidden=storageOk;
 get('save-status').textContent=storageOk?'':'저장할 수 없습니다. 창을 닫으면 진행을 잃을 수 있습니다.';
 if(canDecide(flow)&&!site?.isOpen()&&!proposalDraft&&!treatyDraft&&!breakReviewId&&!mediation?.isOpen())updateSelection();
 showView(currentView);
}
function updateSelection(){
 const action=getAction(state,selected);
 get('forecast').hidden=!action;
 get('forecast').textContent=action?`예상 · ${action.forecast}`:'';
 get('advance-button').disabled=!action||action.cost>state.countries[state.playerId].treasury||(action.foodCost??0)>state.countries[state.playerId].food;
 get('advance-button').textContent=action?`${action.name} 실행 · 1분기 진행 →`:'명령을 선택하세요';
 document.querySelectorAll('.policy').forEach(label=>label.classList.toggle('selected',label.querySelector('input').value===selected));
}
function focusResult(){showView('decision');get('decision-title').focus({preventScroll:true});const target=window.matchMedia('(max-width:1099px)').matches?document.querySelector('.command-dock'):get('situation-room');target.scrollIntoView({block:'start',behavior:'instant'});}
function focusMapOutcome(){showView('decision');document.querySelector('[data-camera-action="reset"]')?.click();get('map-attention-header').focus({preventScroll:true});get('map-attention-header').scrollIntoView({block:'start',behavior:'instant'});}
function modal(content){get('modal-content').innerHTML=content;if(!get('modal').open)get('modal').showModal();}
function restart(){state=createGame(state.playerId);flow={phase:'decision',step:0};currentView='decision';selected=null;requestId=null;clearDrafts();country=state.playerId;inspecting=false;persist();get('modal').close();get('migration-notice').textContent='';render();window.scrollTo({top:0,behavior:'instant'});}
function inspect(id){if(!COUNTRY_IDS.includes(id))return;site?.clear();country=id;inspecting=true;render();get('country-intel').setAttribute('tabindex','-1');get('country-intel').focus({preventScroll:true});}
function inspectPriority(){
 if(!canDecide(flow))return;
 const priority=quarterPriority(state);if(!priority)return;
 if(priority.siteKind&&COUNTRY_IDS.includes(priority.countryId)){site.dispatch('open-facility',{country:priority.countryId,site:priority.siteKind});return;}
 if(priority.view){showView(priority.view,true);return;}
 if(!priority.commandId||!getDomesticOrders(state).some(option=>option.id===priority.commandId))return;
 clearDrafts();requestId=null;selected=null;render();focusResult();
 const input=[...document.querySelectorAll('#policy-form input[name="policy"]')].find(item=>item.value===priority.commandId);
 if(!input)return;
 const extra=input.closest('details');if(extra)extra.open=true;
 input.focus({preventScroll:true});input.closest('.policy').scrollIntoView({block:'center',behavior:'instant'});
 get('announcement').textContent=`${getAction(state,priority.commandId).name}의 조건을 확인하세요. 명령은 아직 선택하지 않았습니다.`;
}
function focusMapChange(id){
 const change=mapConsequences(state).find(item=>item.id===id);if(!change||!COUNTRY_IDS.includes(change.countryId))return;
 showView('decision');
 if(change.siteKind)site.dispatch('open-facility',{country:change.countryId,site:change.siteKind});
 else {inspect(change.countryId);document.querySelector('[data-camera-action="reset"]')?.click();}
 document.querySelector('.map-container').scrollIntoView({block:'center',behavior:'instant'});
 const target=document.querySelector(change.siteKind?`.map-site-target[data-country="${change.countryId}"][data-site="${change.siteKind}"]`:`.land[data-country="${change.countryId}"]`);
 target?.focus({preventScroll:true});
 get('announcement').textContent=`${change.title}. ${change.detail}`;
}
function updateProposal(event){
 if(!proposalDraft||!event.target.closest('#negotiation-form'))return;
 const form=get('negotiation-form'),data=new FormData(form);
 const next={targetId:String(data.get('targetId')),kind:String(data.get('kind')),food:Number(data.get('food')),money:Number(data.get('money'))};if(next.targetId!==proposalDraft.targetId||next.kind!==proposalDraft.kind)proposalPrevious=null;else if(next.food!==proposalDraft.food||next.money!==proposalDraft.money)proposalPrevious=proposalDraft;proposalDraft=next;
 const activeName=document.activeElement?.name;
 if(event.type==='change'&&['targetId','kind'].includes(event.target.name)){
  get('decision-content').innerHTML=renderProposal(state,proposalDraft,proposalPrevious);
  get('negotiation-form').elements.namedItem(activeName)?.focus({preventScroll:true});
 }else{
  get('proposal-preview').innerHTML=renderProposalPreview(state,proposalDraft,proposalPrevious);
  get('proposal-terms').innerHTML=renderProposalTerms(proposalDraft);
  get('send-proposal').disabled=!getAction(state,proposalCommand(proposalDraft));
 }
}
function updateTreaty(event){
 if(!treatyDraft||!event.target.closest('#treaty-form'))return;
 const data=new FormData(get('treaty-form'));
 const next={targetId:String(data.get('targetId')),kind:String(data.get('kind')),food:Number(data.get('food')),money:Number(data.get('money')),duration:Number(data.get('duration'))};if(next.targetId!==treatyDraft.targetId||next.kind!==treatyDraft.kind)treatyPrevious=null;else if(['food','money','duration'].some(key=>next[key]!==treatyDraft[key]))treatyPrevious=treatyDraft;treatyDraft=next;
 const activeName=document.activeElement?.name;
 if(event.type==='change'&&['targetId','kind','duration'].includes(event.target.name)){
  get('decision-content').innerHTML=renderTreatyForm(state,treatyDraft,treatyPrevious);
  get('treaty-form').elements.namedItem(activeName)?.focus({preventScroll:true});
 }else{
  get('treaty-preview').innerHTML=renderTreatyPreview(state,treatyDraft,treatyPrevious);
  get('treaty-terms').innerHTML=renderTreatyTerms(treatyDraft);
  get('send-treaty').disabled=!getAction(state,treatyCommand(treatyDraft));
 }
}
mediation=createMediationController({state:()=>state,resolveAction:command=>getAction(state,command),decisionContent:()=>get('decision-content'),clearCompeting:()=>{clearCompetingDrafts();requestId=null;selected=null;},rerender:render,commit:commitDecision,focus:()=>{focusResult();get('decision-title').scrollIntoView({block:'start',behavior:'instant'});}});
get('decision-content').addEventListener('input',event=>{if(site.input(event)||mediation.input(event))return;if(treatyDraft)updateTreaty(event);else updateProposal(event);});
get('decision-content').addEventListener('change',event=>{if(site.input(event)||mediation.input(event))return;if(treatyDraft){updateTreaty(event);return;}if(proposalDraft){updateProposal(event);return;}if(event.target instanceof HTMLInputElement){selected=event.target.value;updateSelection();}});
function commitDecision(command){
 if(!canDecide(flow))return;
 try{state=advanceTurn(state,command);chronicleOptions={...chronicleOptions,turn:state.turn,page:0};flow=beginReview();selected=null;requestId=null;clearDrafts();country=state.playerId;inspecting=false;persist();get('migration-notice').textContent='';render();focusMapOutcome();get('announcement').textContent=`${state.turn}분기 결과. ${state.history.at(-1).headline}`;}
 catch(error){const target=get('mediation-preview')??get('treaty-preview')??get('proposal-preview')??get('forecast')??get('announcement');target.textContent=error instanceof Error?error.message:'대응을 실행할 수 없습니다.';}
}
get('decision-content').addEventListener('submit',event=>{
 event.preventDefault();
 if(site.submit(event)||mediation.submit(event))return;
 if(event.target.id==='conflict-form'){if(conflictReviewId&&conflictAction(state,selected))commitDecision(selected);return;}
 if(event.target.id==='treaty-form'){if(treatyDraft)commitDecision(treatyCommand(treatyDraft));return;}
 if(event.target.id==='negotiation-form'){if(proposalDraft)commitDecision(proposalCommand(proposalDraft));return;}
 if(!canDecide(flow)||!selected||!(requestId?getScenario(state,requestId).options:getDomesticOrders(state)).some(option=>option.id===selected))return;
 commitDecision(selected);
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 if(site.dispatch(button.dataset.action,button.dataset))return;
 switch(button.dataset.action){
 case 'inspect-priority':inspectPriority();break;
 case 'focus-map-change':focusMapChange(button.dataset.changeId);break;
 case 'open-mediation':case 'accept-mediation-counter':case 'review-peace-offer':case 'counter-peace-offer':case 'peace-offer-reply':case 'review-peace-accord':case 'review-peace-sanction':case 'renegotiate-peace-accord':if(canDecide(flow))mediation.dispatch(button.dataset.action,button.dataset);break;
 case 'review-conflict':if(!canDecide(flow))return;clearDrafts();conflictReviewId=button.dataset.id;requestId=null;selected=null;render();focusResult();get('decision-title').scrollIntoView({block:'start',behavior:'instant'});break;
 case 'map-mode':case 'map-filter':{
  if(button.dataset.action==='map-mode'&&['network','shipments'].includes(button.dataset.mode))mapMode=button.dataset.mode;
  if(button.dataset.action==='map-filter'&&['all','trade','alliance'].includes(button.dataset.filter))mapFilter=button.dataset.filter;
  const selector=button.dataset.action==='map-mode'?`[data-action="map-mode"][data-mode="${mapMode}"]`:`[data-action="map-filter"][data-filter="${mapFilter}"]`;
  updateMap(state,{...flow,selectedCountry:country,mapMode,mapFilter});
  document.querySelector(selector)?.focus({preventScroll:true});
  break;
 }
 case 'show-view':showView(button.dataset.view,true);break;
 case 'diplomacy':showView('diplomacy',true);break;
 case 'focus-order':if(get('modal').open)get('modal').close();focusResult();break;
 case 'close-country-inspect':inspecting=false;country=state.playerId;render();document.querySelector('#country-tabs .active')?.focus({preventScroll:true});break;
 case 'chronicle-period':case 'chronicle-filter':case 'chronicle-page':case 'chronicle-turn':{
  const action=button.dataset.action,key=action.slice('chronicle-'.length);
  const value=button.dataset[key];
  chronicleOptions={...chronicleOptions,[key]:['turn','page'].includes(key)?Number(value):key==='period'&&value!=='all'?Number(value):value,...(['period','filter'].includes(key)?{page:0}:{})};
  renderRecords();
  if(key==='turn'){
   const detail=get('records-content').querySelector('.chronicle-detail'),heading=detail?.querySelector('h3');
   detail?.scrollIntoView({block:'start',behavior:'instant'});
   if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }else get('records-content').querySelector(`[data-action="${action}"][data-${key}="${value}"]`)?.focus({preventScroll:true});
  get('announcement').textContent=`운영 기록 · ${chronicleOptions.turn}분기 선택`;
  break;
 }
 case 'open-treaty':if(!canDecide(flow))return;clearDrafts();treatyDraft={targetId:commandTarget(state,button.dataset.country),kind:'trade_buy',food:3,money:6,duration:4};requestId=null;selected=null;render();focusResult();get('decision-title').scrollIntoView({block:'start',behavior:'instant'});break;
 case 'review-treaty-break':if(!canDecide(flow)||!activeTreaties(state).some(item=>item.id===button.dataset.id))return;clearDrafts();breakReviewId=button.dataset.id;requestId=null;selected=null;render();focusResult();break;
 case 'confirm-treaty-break':if(breakReviewId===button.dataset.id)commitDecision(`break:${breakReviewId}`);break;
 case 'open-proposal':if(!canDecide(flow))return;clearDrafts();proposalDraft={targetId:commandTarget(state,button.dataset.country),kind:'buy',food:6,money:9};requestId=null;selected=null;render();focusResult();get('decision-title').scrollIntoView({block:'start',behavior:'instant'});break;
 case 'negotiation-reply':commitDecision(`reply:${button.dataset.id}:${button.dataset.response}`);break;
 case 'open-request':if(flow.phase!=='decision')return;clearDrafts();requestId=button.dataset.requestId;selected=null;persist();render();focusResult();break;
 case 'domestic':clearDrafts();requestId=null;selected=null;persist();render();focusResult();break;
 case 'review':flow={phase:'result',step:Number(button.dataset.step)};if(flow.step===1&&country===state.playerId)country=COUNTRY_IDS.find(id=>id!==state.playerId);persist();render();focusResult();break;
 case 'overview':flow={phase:'result',step:3};persist();render();focusResult();break;
 case 'next-review':flow=nextReview(flow,state.turn);if(flow.phase==='result'&&flow.step===1)country=COUNTRY_IDS.find(id=>id!==state.playerId);persist();render();focusResult();break;
 case 'next-quarter':if(flow.phase!=='result')return;flow={phase:'decision',step:0};clearDrafts();requestId=null;selected=null;country=state.playerId;inspecting=false;persist();render();focusResult();get('announcement').textContent=`${get('date').textContent}. 새 명령을 골라주세요. 실행 전에는 시간이 흐르지 않습니다.`;break;
 case 'inspect-country':inspect(button.dataset.countryId);break;
 case 'view-map':showView('decision');get('situation-room').scrollIntoView({block:'start',behavior:'instant'});break;
 case 'back-to-result':focusResult();break;
 }
});
for(const container of [document.querySelector('.world-map'),get('country-tabs')]){
 container.addEventListener('click',event=>{if(event.target.closest('[data-site]'))return;const item=event.target.closest('[data-country]');if(item)inspect(item.dataset.country);});
 container.addEventListener('keydown',event=>{if(event.target.closest('[data-site]'))return;const item=event.target.closest('.land[data-country]');if(item&&['Enter',' '].includes(event.key)){event.preventDefault();inspect(item.dataset.country);}});
}
site=createSiteController({state:()=>state,phase:()=>flow.phase,clearCompeting:clearDrafts,select:selection=>{country=selection.countryId;inspecting=false;currentView='decision';requestId=null;selected=null;},rerender:render,focus:focusResult,commit:commitDecision});
let pickerChoice=state.playerId;
function openCountryPicker(){persist();pickerChoice=state.playerId;get('modal').classList.add('country-picker-dialog');modal(countryPicker(pickerChoice,savedCountries()));}
function closeModal(){get('modal').close();get('modal').classList.remove('country-picker-dialog');}
get('country-select-button').addEventListener('click',openCountryPicker);
get('modal-content').addEventListener('change',event=>{
 if(!(event.target instanceof HTMLInputElement)||event.target.name!=='nation')return;
 pickerChoice=event.target.value;
 document.querySelectorAll('.nation-card').forEach(card=>card.classList.toggle('selected',card.querySelector('input').value===pickerChoice));
 const labels=countryStartLabel(pickerChoice,savedCountries());get('nation-selection-label').textContent=labels.selection;get('nation-start-button').textContent=labels.action;
});
get('modal-content').addEventListener('submit',event=>{
 if(event.target.id!=='country-picker-form')return;event.preventDefault();
 const campaign=loadGame(pickerChoice);state=campaign.state;flow=campaign.flow;requestId=campaign.requestId;currentView='decision';chronicleOptions={period:12,metric:'food',filter:'all',page:0};selected=null;clearDrafts();country=state.playerId;inspecting=false;
 persist();closeModal();render();window.scrollTo({top:0,behavior:'instant'});
 get('migration-notice').textContent=campaign.status==='migrated'?'기존 루멘 선택을 새 운영 규칙으로 다시 계산했습니다. 이전 기록은 보존했습니다.':campaign.status==='invalid'?'이 국가의 저장 기록을 읽지 못해 첫 분기를 열었습니다. 다른 국가 기록은 보존됩니다.':'';
 get('announcement').textContent=state.turn?`${COUNTRIES[state.playerId].name}의 운영 기록을 열었습니다. ${state.turn}분기 완료.`:`${COUNTRIES[state.playerId].name}의 첫 분기입니다. 첫 명령을 골라주세요.`;
});
get('modal').addEventListener('close',()=>get('modal').classList.remove('country-picker-dialog'));
get('help-button').addEventListener('click',()=>modal(renderHelp(flow.phase==='result')));
get('history-button').addEventListener('click',()=>showView('records',true));
get('records-content').addEventListener('change',event=>{
 const keys={'chronicle-metric':'metric','chronicle-partner':'partner','chronicle-quarter':'turn'},key=keys[event.target.name];
 if(!key)return;
 chronicleOptions={...chronicleOptions,[key]:key==='turn'?Number(event.target.value):event.target.value};
 renderRecords();get('records-content').querySelector(`[name="${event.target.name}"]`)?.focus({preventScroll:true});
 get('announcement').textContent=`운영 기록 · ${chronicleOptions.turn}분기 선택`;
});
get('close-modal').addEventListener('click',()=>get('modal').close());
get('restart-button').addEventListener('click',()=>{if(!state.turn){restart();return;}modal('<h2>새로운 세계를 시작할까요?</h2><p>현재 운영 국가의 기록만 초기화합니다. 다른 국가의 저장 기록은 보존됩니다.</p><div class="dialog-actions"><button class="secondary-button" data-action="cancel">계속 운영</button><button class="primary-button" data-action="replay">처음부터 다시 →</button></div>');});
get('modal-content').addEventListener('click',event=>{const action=event.target.closest('[data-action]')?.dataset.action;if(action==='replay')restart();if(action==='cancel')get('modal').close();if(action==='chronicle'){get('modal').close();showView('records',true);}});
render();
if(loaded.status==='migrated')get('migration-notice').textContent='기존 루멘 기록을 새 국가 운영 규칙으로 다시 계산해 이어갑니다. 운영 국가 선택에서 다른 나라를 시작할 수 있습니다. 이전 저장 기록은 보존했습니다.';
if(loaded.status==='invalid')get('migration-notice').textContent='저장 기록을 읽지 못해 새로운 세계를 열었습니다.';

if(loaded.status==='new')openCountryPicker();

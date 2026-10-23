import {SITE_DEFS,getAction,PROFILES} from './engine.mjs?v=31';
import {mapConsequences} from './map-consequences.mjs?v=31';
import {quarterPriority} from './quarter-priority.mjs?v=31';
import {resultCauses} from './result-causes.mjs?v=31';

const decisionPresentation={
 resource:{tone:'danger',icon:'alert'},
 deadline:{tone:'danger',icon:'reply'},
 supply:{tone:'danger',icon:'alert'},
 construction:{tone:'notice',icon:'build'},
};

const decisionPin=(state,priority)=>{
 const countryId=priority.countryId??state.playerId??'lumen',siteKind=priority.siteKind??null;
 let label=getAction(state,priority.commandId)?.name??'이번 과제',value='명령 검토 →';
 if(priority.kind==='resource'){
  const country=state.countries?.[state.playerId];
  if(country?.food<35){label='식량 부족';value=`식량 ${country.food}`;}
  else{label='물가 급등';value=`생활물가 ${country?.price??0}`;}
 }else if(priority.kind==='deadline'){
  label='회신 마감';value=priority.title;
 }else if(priority.kind==='supply'){
  label='공급 중단';value=siteKind&&SITE_DEFS[siteKind]?SITE_DEFS[siteKind].name:priority.title;
 }else if(priority.kind==='construction'){
  label='완공 임박';value=siteKind&&SITE_DEFS[siteKind]?SITE_DEFS[siteKind].name:priority.title;
 }
 const presentation=decisionPresentation[priority.kind]??{tone:'neutral',icon:'arrow'};
 return {
  id:`priority:${priority.kind}:${countryId}${siteKind?`:${siteKind}`:''}`,
  countryId,
  siteKind,
  label,
  value,
  ...presentation,
  action:'inspect-priority',
  changeId:null,
 };
};

const signedValue=detail=>detail.match(/(?:식량|국고)\s+([+−-]\d+(?:억)?)/)?.[1]??null;

function consequencePresentation(change){
 if(['sanction-expiry','sanction-ceasefire_ended','sanction-accord_restriction_expired','sanction-peace_response_expired'].includes(change.kind))return {value:'변경',tone:'neutral',icon:'arrow'};
 if(['site-completed','national-completed','joint-activated'].includes(change.kind))return {value:'완공',tone:'positive',icon:'check'};
 if(['site-started','national-started','joint-started'].includes(change.kind))return {value:'착공',tone:'notice',icon:'build'};
 if(change.kind==='joint-completed')return {value:'종료',tone:'neutral',icon:'check'};
 if(change.kind==='joint-suspended'||change.kind.startsWith('sanction-'))return {value:'중단',tone:'danger',icon:'alert'};
 if(change.kind==='joint-resumed')return {value:'재개',tone:'positive',icon:'check'};
 const amount=signedValue(change.detail);
 if(amount){
  const negative=amount.startsWith('-')||amount.startsWith('−');
  return {value:amount,tone:negative?'danger':'positive',icon:negative?'alert':'check'};
 }
 return {value:'변경',tone:'neutral',icon:'arrow'};
}

const consequencePin=change=>({
 id:`result:${change.id}`,
 countryId:change.countryId,
 siteKind:change.siteKind??null,
 label:change.title,
 ...consequencePresentation(change),
 action:'focus-map-change',
 changeId:change.id,
});

function domesticSitePin(state,last,changes){
 const playerId=state.playerId??'lumen';
 const completed=(last.siteDevelopment?.completed??[]).find(item=>item.countryId===playerId&&SITE_DEFS[item.siteKind]);
 const started=(last.siteDevelopment?.started??[]).find(item=>item.countryId===playerId&&SITE_DEFS[item.siteKind]);
 const project=completed??started;
 if(!project)return null;
 const kind=completed?'site-completed':'site-started',change=changes.find(item=>item.kind===kind&&item.countryId===playerId&&item.siteKind===project.siteKind);
 return {
  id:`result:${kind}:${last.turn}:${playerId}:${project.siteKind}`,
  countryId:playerId,
  siteKind:project.siteKind,
  label:SITE_DEFS[project.siteKind].name,
  value:completed?'완공':'착공',
  tone:completed?'positive':'notice',
  icon:completed?'check':'build',
  action:change?'focus-map-change':'focus-order',
  changeId:change?.id??null,
 };
}

function commandPin(state,last){
 const countryId=state.playerId,completed=last.development?.completed?.length,started=last.development?.started?.length;
 const base={id:`result:command:${last.turn}:${countryId}`,countryId,siteKind:null,action:'focus-order',changeId:null};
 if(completed||started)return {...base,label:PROFILES[countryId].facilityName,value:completed?'완공':'착공',tone:completed?'positive':'notice',icon:completed?'check':'build'};
 const effect=last.policyEffect??{},key=['food','price','trust','treasury'].find(metric=>Number.isFinite(effect[metric])&&effect[metric]!==0);
 if(key){
  const value=effect[key],positive=key==='price'?value<0:value>0;
  return {...base,label:`명령 차이 · ${{food:'식량',price:'물가',trust:'신뢰',treasury:'국고'}[key]}`,value:`유지 대비 ${value>0?'+':'−'}${Math.abs(value)}${key==='treasury'?'억':''}`,tone:positive?'positive':'danger',icon:'arrow'};
 }
 return null;
}

function resultAttention(state){
 const last=state.history?.at(-1),causes=resultCauses(state);
 if(!last||!causes)return null;
 const playerId=state.playerId??'lumen',food=causes.metrics.food,treasury=causes.metrics.treasury,changes=mapConsequences(state);
 const foodPin={
  id:`result:food:${last.turn}:${playerId}`,
  countryId:playerId,
  siteKind:null,
  label:'분기 식량',
  value:`${food.before} → ${food.after}`,
  tone:food.delta<0?'danger':food.delta>0?'positive':'neutral',
  icon:'arrow',
  action:'focus-order',
  changeId:null,
 };
 const sitePin=domesticSitePin(state,last,changes),direct=sitePin??commandPin(state,last),changePin=direct?null:changes[0]?consequencePin(changes[0]):null;
 return {
  mode:'result',
  heading:last.actionLabel,
  actionLabel:'결과 자세히',
  pins:[foodPin,direct??changePin].filter(Boolean).slice(0,2),
  metrics:[
   {key:'food',label:'식량',before:food.before,after:food.after,delta:food.delta},
   {key:'treasury',label:'국고',before:treasury.before,after:treasury.after,delta:treasury.delta},
  ],
 };
}

export function mapAttention(state,phase='decision'){
 if(phase==='result')return resultAttention(state);
 const priority=quarterPriority(state);
 return {mode:'decision',heading:priority.title,actionLabel:priority.actionLabel,pins:[decisionPin(state,priority)],metrics:[]};
}

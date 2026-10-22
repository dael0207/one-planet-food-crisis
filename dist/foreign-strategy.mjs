import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';

const MODES={
 food:{label:'식량 안정'},fiscal:{label:'재정 회복'},resilience:{label:'공급 자립'},trade:{label:'교역 확대'},development:{label:'장기 개발'},
};
const DEFAULT_MODE={lumen:'food',nord:'trade',cera:'trade',altia:'development',marin:'trade',solis:'resilience'};
const IMPORT_ACTIONS=new Set(['secure_imports','expand_routes','emergency_import','goal_emergency_import']);
const DEPENDENT_IDS=new Set(['nord','marin','solis']);
const exporter=id=>id==='lumen'||id==='cera';

export const strategyActive=state=>Number.isSafeInteger(state?.foreignStrategyStartTurn)&&state.turn>=state.foreignStrategyStartTurn;

const relationKey=(a,b)=>[a,b].sort().join(':');
const relation=(state,a,b)=>state.relations?.[relationKey(a,b)]??50;

function postureReaction(state,actorId,playerAction){
 const actionId=playerAction?.id,playerId=state.playerId;
 if(actionId==='embargo'&&exporter(playerId)&&DEPENDENT_IDS.has(actorId))return {posture:'contain',reason:`${COUNTRIES[playerId].name}의 수출 제한에 대응해 공급선을 분산합니다.`,policy:actionId};
 if(actionId==='reopen'&&exporter(playerId)&&DEPENDENT_IDS.has(actorId))return {posture:'cooperate',reason:`${COUNTRIES[playerId].name}의 시장 재개를 새 공급 협력 기회로 봅니다.`,policy:actionId};
 if(actionId==='balanced'&&playerId==='lumen'&&actorId==='nord')return {posture:'cooperate',reason:'교역 약속을 지킨 조치를 공급 협력 신호로 평가합니다.',policy:actionId};
 if(actionId==='aid'&&actorId===(playerAction.targetId??'nord'))return {posture:'cooperate',reason:'실제 식량 지원을 협력 의지로 평가합니다.',policy:actionId};
 const proposal=playerAction?.proposal,proposalCooperation=proposal&&playerAction.preview?.response==='accept'&&['buy','sell','aid_out','aid_in'].includes(proposal.kind);
 if(proposalCooperation&&actorId===proposal.targetId)return {posture:'cooperate',reason:'수락 가능한 직접 거래·지원 제안을 협력 신호로 평가합니다.',policy:actionId};
 const treaty=playerAction?.treatyDraft;
 if(treaty&&playerAction.treatyPreview?.response==='accept'&&actorId===treaty.targetId)return {posture:'cooperate',reason:'수락된 장기 협정을 지속 협력 신호로 평가합니다.',policy:actionId};
 const jointTarget=playerAction?.jointInvestment?.partnerId??playerAction?.jointInvestment?.targetId;
 if(playerAction?.jointPreview?.outcome==='accepted'&&jointTarget===actorId)return {posture:'cooperate',reason:'수락된 공동 투자 결정을 장기 협력 신호로 평가합니다.',policy:actionId};
 return null;
}

function selectedMode(state,id,prior,importStreak){
 const country=state.countries[id],urgentFood=country.food<30,urgentFiscal=country.treasury<18;
 let mode=urgentFood?'food':urgentFiscal?'fiscal':importStreak>=2&&country.infrastructure<3?'resilience':DEFAULT_MODE[id];
 if(!urgentFood&&!urgentFiscal&&id==='cera'&&country.food>=70&&country.treasury>=25)mode='trade';
 if(!urgentFood&&!urgentFiscal&&id==='altia'&&country.treasury>=35)mode='development';
 if(prior&&mode!==prior.mode&&state.turn-prior.sinceTurn<2&&!urgentFood&&!urgentFiscal)mode=prior.mode;
 return mode;
}

function modeReason(mode,country,prior,importStreak,lastAction){
 const trend=prior?.lastMetrics?`지난 검토 대비 식량 ${country.food-prior.lastMetrics.food>=0?'+':''}${country.food-prior.lastMetrics.food} · 국고 ${country.treasury-prior.lastMetrics.treasury>=0?'+':''}${country.treasury-prior.lastMetrics.treasury}.`:'';
 if(mode==='food')return `식량 ${country.food}로 비축 회복이 가장 시급합니다. ${trend}`.trim();
 if(mode==='fiscal')return `국고 ${country.treasury}로 사업 지속 여력이 낮아 재정 회복을 우선합니다. ${trend}`.trim();
 if(mode==='resilience')return importStreak>=2?`최근 ‘${lastAction?.name??'식량 조달'}’이 ${importStreak}회 이어져 생산 기반 ${country.infrastructure}/3 확충으로 의존을 낮춥니다. ${trend}`.trim():`생산 기반 ${country.infrastructure}/3과 식량 비축 ${country.food}점을 함께 보강합니다. ${trend}`.trim();
 if(mode==='trade')return `식량 ${country.food} · 국고 ${country.treasury}의 가용 여력으로 교역 성과를 우선합니다. ${trend}`.trim();
 return `국고 ${country.treasury} · 생산 기반 ${country.infrastructure}/3을 바탕으로 장기 개발을 우선합니다. ${trend}`.trim();
}

function nextStrategy(context,id){
 const {state,before,playerAction}=context;
 const prior=before.foreignStrategies?.[id],country=state.countries[id],lastAction=before.foreignGoals?.[id]?.lastAction??null;
 const continuedImport=lastAction&&IMPORT_ACTIONS.has(lastAction.id)&&lastAction.turn>=state.turn-1;
 const importStreak=continuedImport?Math.min(4,(prior?.importStreak??0)+1):0,mode=selectedMode(state,id,prior,importStreak);
 const reaction=postureReaction(state,id,playerAction),retained=prior?.posture&&prior.posture!=='neutral'&&state.turn<=prior.postureUntil;
 const posture=reaction?.posture??(retained?prior.posture:'neutral'),postureReason=reaction?.reason??(retained?prior.postureReason:'현재 적용 중인 특별 대응이 없습니다.'),postureUntil=reaction?state.turn+2:(retained?prior.postureUntil:0);
 const modeChanged=!prior||prior.mode!==mode,previousAction=lastAction?{id:lastAction.id,name:lastAction.name,turn:lastAction.turn}:prior?.previousAction??null;
 return {
  mode,label:MODES[mode].label,reason:modeReason(mode,country,prior,importStreak,lastAction),sinceTurn:modeChanged?state.turn:prior.sinceTurn,lastTurn:state.turn,
  previousMode:modeChanged&&prior?prior.mode:prior?.previousMode??null,previousAction,
  trend:{food:prior?.lastMetrics?country.food-prior.lastMetrics.food:0,treasury:prior?.lastMetrics?country.treasury-prior.lastMetrics.treasury:0},
  posture,postureReason,postureUntil,observedPolicy:reaction?.policy??prior?.observedPolicy??null,
  lastMetrics:{food:country.food,treasury:country.treasury},importStreak,
 };
}

function changeRecord(state,id,prior,current){
 const modeChanged=!prior||prior.mode!==current.mode,postureChanged=!prior||prior.posture!==current.posture;if(!modeChanged&&!postureChanged)return null;
 const reason=[modeChanged?current.reason:null,postureChanged?current.postureReason:null].filter(Boolean).join(' '),title=`${COUNTRIES[id].name} 전략 ${current.label}`;
 return {source:'foreign_strategy',type:'strategy',actorId:id,countryId:id,...(postureChanged?{targetId:state.playerId}:{}),title,reason,text:`${title}. ${reason}`,mode:current.mode,posture:current.posture,previousPosture:prior?.posture??null,postureExpired:Boolean(prior?.posture&&prior.posture!=='neutral'&&current.posture==='neutral'),turn:state.turn};
}

export function prepareForeignStrategies(next,before,playerAction,actions=[]){
 if(!strategyActive(next))return;
 const context={state:next,before,playerAction},strategies={},records=[];
 for(const id of COUNTRY_IDS.filter(countryId=>countryId!==next.playerId)){
  const current=nextStrategy(context,id),record=changeRecord(next,id,before.foreignStrategies?.[id],current);strategies[id]=current;if(record)records.push(record);
 }
 next.foreignStrategies=strategies;next.lastForeignStrategyEvents=records.slice(-5);
 next.foreignStrategyHistory=[...(before.foreignStrategyHistory??[]),...records].slice(-20);actions.push(...records.slice(0,5));
}

export function foreignStrategyContext(state,targetId,kind,effectiveTurn=state.turn){
 if(!strategyActive({...state,turn:effectiveTurn}))return {scoreDelta:0,reasons:[],remaining:0,posture:'neutral'};
 const strategy=state.foreignStrategies?.[targetId];
 if(!strategy||effectiveTurn>strategy.postureUntil||strategy.posture==='neutral')return {scoreDelta:0,reasons:[],remaining:0,posture:'neutral'};
 const scoreDelta=strategy.posture==='cooperate'?6:-10,remaining=Math.max(0,strategy.postureUntil-effectiveTurn+1),verb=strategy.posture==='cooperate'?'협력':'대응';
 return {scoreDelta,reasons:[`${COUNTRIES[targetId].name}의 ${verb} 태도가 이 제안에 ${scoreDelta>0?'+':''}${scoreDelta}점으로 반영됩니다 · ${remaining}분기 남음.`],remaining,posture:strategy.posture,kind};
}

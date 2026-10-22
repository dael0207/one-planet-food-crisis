import {COUNTRIES,COUNTRY_IDS,EVENTS,eventForTurn,initialCountries} from './country-data.mjs?v=29';
import {PROFILES} from './nation-profiles.mjs?v=29';
import {getPolicies as policiesFor,LUMEN_POLICIES} from './policies.mjs?v=29';
import {initialRequest,requestAction,applyRequest,applyAgreements,updateRequests,produce,runForeignActions,finalizeCountries} from './world.mjs?v=29';
import {initialRelations,negotiationAction,applyNegotiation,updateNegotiations,adjustRelation} from './negotiations.mjs?v=29';
import {activeTreaties,applyTreatyDecision,getReliability,previewTreaty,runTreaties,treatyAction,treatyCommand} from './treaties.mjs?v=29';
import {activeForeignTreaties,foreignMarketSummary,marketContext,runForeignDiplomacy} from './foreign-diplomacy.mjs?v=29';
import {createObjectives,advanceObjectives,unlockedPolicies} from './objectives.mjs?v=29';
import {createForeignGoals,runForeignGoalPolicies,finishForeignGoals} from './foreign-goals.mjs?v=29';
import {runGoalRelations} from './goal-relations.mjs?v=29';
import {activeConflicts,applyConflictChoice,conflictAction,conflictChoicePreview,conflictMarketContext,prepareGoalConflicts,runGoalConflicts,tradeBlocked} from './goal-conflicts.mjs?v=29';
import {applyMediation,mediationAction,mediationCommand,pendingMediationCounters,previewMediation,reliefActive,updateMediations} from './mediation.mjs?v=29';
import {applyPeaceReply,pendingPeaceOffers,peaceCounterCommand,peaceOfferAction,peaceOfferPreview,peaceReplyCommand,runPeaceOffers} from './peace-offers.mjs?v=29';
import {applyPeaceComplianceResponse,peaceComplianceAction,peaceComplianceCommand,peaceCompliancePreview,preparePeaceComplianceMediation,reconcilePeaceCompliance,runPeaceCompliance} from './peace-compliance.mjs?v=29';
import {finishPeaceResponses,runPeaceResponses} from './peace-response.mjs?v=29';
import {peaceResponseCountryLabel,peaceResponseEnabled,peaceResponseMarketContext,peaceResponsePairs,peaceResponseSummary} from './peace-response-model.mjs?v=29';
import {SITE_DEFS,SITE_KINDS,applySiteDecision,completeSiteProjects,runSiteEffects,siteAction,siteView} from './site-operations.mjs?v=29';
import {prepareForeignSites} from './foreign-sites.mjs?v=29';
import {runForeignSiteDecisions} from './foreign-sites-commerce.mjs?v=29';
import {applyJointInvestmentDecision,jointCommand,jointInvestmentAction,previewJointInvestment,runJointInvestments} from './joint-investments.mjs?v=29';
import {applyCabinetDecision,cabinetAction,cabinetPlanFacts,currentAgenda,runCabinetFollowthrough} from './cabinet-agendas.mjs?v=29';
import {prepareForeignStrategies} from './foreign-strategy.mjs?v=29';

export {COUNTRIES,COUNTRY_IDS,EVENTS,eventForTurn,PROFILES,SITE_DEFS,SITE_KINDS,activeTreaties,activeForeignTreaties,foreignMarketSummary,getReliability,marketContext,previewTreaty,treatyCommand,activeConflicts,conflictChoicePreview,conflictMarketContext,tradeBlocked,mediationCommand,pendingMediationCounters,previewMediation,reliefActive,pendingPeaceOffers,peaceCounterCommand,peaceOfferPreview,peaceReplyCommand,peaceComplianceCommand,peaceCompliancePreview,peaceResponseCountryLabel,peaceResponseEnabled,peaceResponseMarketContext,peaceResponsePairs,peaceResponseSummary,siteView,siteAction,applySiteDecision,completeSiteProjects,runSiteEffects,jointCommand,previewJointInvestment,jointInvestmentAction,applyJointInvestmentDecision,runJointInvestments,currentAgenda,cabinetAction,cabinetPlanFacts,applyCabinetDecision,runCabinetFollowthrough};
export const COUNTRY_DEFS=COUNTRIES;
export const POLICIES=LUMEN_POLICIES;
export const getPolicies=state=>[...policiesFor(state),...unlockedPolicies(state),...(currentAgenda(state)?.options??[])];

export function createGame(playerId='lumen',{networkStartTurn=1,policyStartTurn=1,objectiveStartTurn=1,worldGoalStartTurn=1,conflictStartTurn=1,mediationStartTurn=1,peaceOfferStartTurn=1,peaceComplianceStartTurn=1,peaceResponseStartTurn=1,foreignSiteStartTurn=1,jointStartTurn=1,foreignStrategyStartTurn=1}={}){
 if(!COUNTRY_IDS.includes(playerId))throw new Error('선택할 수 없는 국가입니다.');
 const request=initialRequest(playerId);
 if(!Number.isSafeInteger(networkStartTurn)||networkStartTurn<1)throw new Error('협정망 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(policyStartTurn)||policyStartTurn<1)throw new Error('정책 규칙 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(objectiveStartTurn)||objectiveStartTurn<1)throw new Error('국가 목표 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(worldGoalStartTurn)||worldGoalStartTurn<1)throw new Error('세계 목표 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(conflictStartTurn)||conflictStartTurn<1)throw new Error('목표 분쟁 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(mediationStartTurn)||mediationStartTurn<1)throw new Error('분쟁 중재 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(peaceOfferStartTurn)||peaceOfferStartTurn<1)throw new Error('타국 평화 제안 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(peaceComplianceStartTurn)||peaceComplianceStartTurn<1)throw new Error('평화 합의 이행 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(peaceResponseStartTurn)||peaceResponseStartTurn<1)throw new Error('평화 위반 대응 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(foreignSiteStartTurn)||foreignSiteStartTurn<1)throw new Error('외국 현장 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(jointStartTurn)||jointStartTurn<1)throw new Error('공동 투자 시작 분기가 올바르지 않습니다.');
 if(!Number.isSafeInteger(foreignStrategyStartTurn)||foreignStrategyStartTurn<1)throw new Error('외국 전략 시작 분기가 올바르지 않습니다.');
 return {version:13,playerId,turn:0,networkStartTurn,policyStartTurn,objectiveStartTurn,worldGoalStartTurn,conflictStartTurn,mediationStartTurn,peaceOfferStartTurn,peaceComplianceStartTurn,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn,peaceAccords:[],lastPeaceComplianceEvents:[],peaceOffers:[],lastPeaceOfferEvents:[],goalConflicts:[],lastConflictEvents:[],conflictCooldownUntil:0,mediations:[],lastMediationEvents:[],mediationOfferTurnByConflict:{},foreignGoals:createForeignGoals(playerId),lastGoalEvents:[],objectives:createObjectives(playerId),activePolicy:'open',farmLevel:0,marketShare:1,projects:[],history:[],commands:[],requests:[request],agreements:[],negotiations:[],treaties:[],lastTreatyEvents:[],foreignTreaties:[],foreignTreatyHistory:[],lastForeignEvents:[],foreignPairCooldowns:{},reliability:Object.fromEntries(COUNTRY_IDS.map(id=>[id,70])),relations:initialRelations(),lastRequestTurn:{[request.fromId]:0},countries:initialCountries()};
}

export function getAction(state,id){
 const joint=jointInvestmentAction(state,id);if(joint)return joint;
 const site=siteAction(state,id);if(site)return site;
 const cabinet=cabinetAction(state,id);if(cabinet)return cabinet;
 const policy=getPolicies(state).find(item=>item.id===id);
 if(!policy)return peaceComplianceAction(state,id)??peaceOfferAction(state,id)??mediationAction(state,id)??conflictAction(state,id)??treatyAction(state,id)??negotiationAction(state,id)??requestAction(state,id);
 if(['secure_imports','expand_routes','emergency_import'].includes(id)&&tradeBlocked({...state,turn:state.turn+1},'cera',state.playerId))return null;
 if(id==='invest'&&((state.projects??[]).some(project=>!project.type||project.type==='facility')||state.farmLevel>=3))return null;
 const playerId=state.playerId??'lumen',profile=PROFILES[playerId],legacyBalanced=playerId==='lumen'&&id==='balanced'&&state.turn+1<(state.policyStartTurn??1);
 const maintainEmbargo=id==='maintain'&&state.activePolicy==='embargo',cost=id==='invest'?profile.investmentCost+state.farmLevel*4:legacyBalanced?0:policy.cost;
 if(legacyBalanced)return {...policy,name:'교역 유지',tag:'안정',cost,foodCost:0,legacyPolicy:true,description:'수출 약속과 기존 교역을 유지합니다.',forecast:'곡물 13 수출 · 수출 수입 유지'};
 if(maintainEmbargo)return {...policy,name:'수출 제한 유지',tag:'국내 우선',cost,foodCost:0,description:'추가 정책 지출 없이 현재 식량 수출 제한을 유지합니다.',forecast:'추가 정책 비용 없음 · 필수 인도만 유지 · 국내 재고 보호'};
 return {...policy,cost,foodCost:policy.foodCost??0,description:id==='invest'?`${profile.facilityName} ${state.farmLevel+1}단계를 건설합니다. 두 분기 뒤 완공됩니다.`:policy.description};
}

function citizenStories(country,state){
 const profile=PROFILES[state.playerId],name=COUNTRIES[state.playerId].name;
 return [
  {name:'도시 생활자',role:`${name}의 가계`,text:`생활비 지수 ${country.price}. ${country.price>125?'식료품 부담으로 저축을 줄였습니다.':'식비를 감당하며 다음 달을 준비합니다.'}`},
  {name:'생산 현장',role:profile.facilityName,text:`생산 시설 ${state.farmLevel}단계. ${(state.projects??[]).some(project=>!project.type||project.type==='facility')?'새 시설이 건설 중입니다.':'다음 계절의 공급을 준비합니다.'}`},
  {name:'공공 급식 가정',role:`${name}의 시민`,text:`식량 안정 ${country.food}. ${country.food<35?'배급과 지원 확대를 기다립니다.':'일상의 식사가 안정적으로 이어집니다.'}`},
 ];
}

function policyTransfer(next,fromId,toId,food,payment,parts,actions,label){
 const seller=next.countries[fromId],buyer=next.countries[toId],amount=Math.min(food,Math.max(0,seller.food-20));
 if(tradeBlocked(next,fromId,toId)){buyer.treasury+=payment;actions.push({countryId:fromId,targetId:toId,type:'sanction',source:'goal_conflict',text:'무역 제재로 '+seller.name+' → '+buyer.name+' 정책 거래가 중단되고 대금 '+payment+'이 반환됐습니다.'});return 0;}
 if(amount<=0){buyer.treasury+=payment;actions.push({countryId:fromId,targetId:toId,type:'austerity',source:'policy',text:`${seller.name}의 재고 부족으로 계약 대금을 반환했습니다 · ${payment}.`});return 0;}
 const paid=Math.ceil(payment*amount/food);buyer.treasury+=payment-paid;seller.food-=amount;seller.treasury+=paid;buyer.food+=amount;parts.push({label,value:amount});actions.push({countryId:fromId,targetId:toId,type:'trade',source:'policy',text:`${seller.name} → ${buyer.name}: 식량 ${amount} 공급 · 대금 ${paid} 이전.`});return amount;
}
function applyDomestic(next,action,parts,actions){
 const playerId=next.playerId,player=next.countries[playerId];
 if(action.source==='cabinet'){applyCabinetDecision(next,action,{parts,actions});return;}
 if(action.site){applySiteDecision(next,action,{parts,actions});return;}
 if(action.goalEffects){
  for(const metric of ['food','price','trust','approval'])player[metric]+=action.goalEffects[metric]??0;
  if(action.goalEffects.food)parts.push({label:`국가 목표 정책 · ${action.name}`,value:action.goalEffects.food});
  actions.push({countryId:playerId,type:'policy',source:'policy',text:`${action.name}을 실행했습니다. ${action.forecast}`});return;
 }
 switch(action.id){
 case 'balanced':if(action.legacyPolicy){player.trust+=2;next.countries.nord.trust+=1;}else{player.trust+=4;adjustRelation(next,'lumen','nord',6);}break;
 case 'reopen':player.trust+=2;if(playerId==='lumen')next.countries.nord.trust+=1;break;
 case 'embargo':if(playerId==='lumen')adjustRelation(next,'lumen','nord',-5);else if(playerId==='cera')for(const id of ['nord','solis','marin'])adjustRelation(next,'cera',id,-3);break;
 case 'maintain':break;
 case 'subsidy':player.price-=16;player.approval+=6;break;
 case 'invest':next.projects.push({type:'facility',countryId:playerId,dueTurn:next.turn+2});break;
 case 'aid':player.food-=7;next.countries.nord.food+=7;next.countries.nord.treasury+=9;player.trust+=5;next.countries.nord.trust+=7;adjustRelation(next,playerId,'nord',6);parts.push({label:'노르드 식량 지원',value:-7});actions.push({countryId:playerId,targetId:'nord',type:'aid',source:'policy',text:'노르드에 식량 7과 지원금 9를 전달했습니다.'});break;
 case 'secure_imports':policyTransfer(next,'cera','nord',8,action.cost,parts,actions,'장기 수입선 확보');player.price-=8;break;
 case 'strategic_reserve':player.food+=4;player.price-=18;player.approval+=4;parts.push({label:'전략 비축 방출',value:4});break;
 case 'export_push':{let sent=0;for(const targetId of ['nord','solis']){if(tradeBlocked(next,'cera',targetId)){actions.push({countryId:'cera',targetId,type:'sanction',source:'goal_conflict',text:'무역 제재로 세라 → '+COUNTRIES[targetId].name+' 추가 수출이 중단됐습니다.'});continue;}next.countries[targetId].food+=4;sent+=4;actions.push({countryId:'cera',targetId,type:'trade',source:'policy',text:'세라가 추가 곡물 4를 '+COUNTRIES[targetId].name+'에 선적했습니다.'});}player.food-=sent;player.treasury+=Math.ceil(14*sent/8);if(sent)player.trust+=4;parts.push({label:'추가 곡물 수출',value:-sent});break;}
 case 'research':player.food+=5;player.trust+=2;parts.push({label:'고수확 종자 연구 성과',value:5});break;
 case 'license':{const buyerId=['nord','marin','cera','lumen','solis'].sort((a,b)=>next.countries[b].treasury-next.countries[a].treasury)[0],paid=Math.min(12,next.countries[buyerId].treasury);next.countries[buyerId].treasury-=paid;player.treasury+=paid;player.trust+=3;actions.push({countryId:'altia',targetId:buyerId,type:'trade',source:'policy',text:`알티아가 ${next.countries[buyerId].name}에 기술 사용권을 제공해 국고 수입 ${paid} 발생.`});break;}
 case 'expand_routes':policyTransfer(next,'cera','marin',6,action.cost,parts,actions,'대체 항로 반입');player.price-=6;break;
 case 'emergency_import':policyTransfer(next,'cera','marin',9,action.cost,parts,actions,'긴급 선박 수입');break;
 case 'ration':player.food+=4;player.price-=10;player.approval+=5;parts.push({label:'배급으로 줄인 손실',value:4});break;
 case 'resilience':player.food+=5;player.trust+=2;parts.push({label:'가뭄 회복 사업',value:5});break;
 default:if(!action.requestId&&!action.proposal&&!action.negotiationId&&!action.treatyDraft&&!action.treatyBreakId&&!action.conflictChoice&&!action.mediation&&!action.peaceReply&&!action.peaceCompliance&&!action.jointInvestment)throw new Error('알 수 없는 정책입니다.');
 }
}

function simulate(state,action){
 const next=structuredClone(state),parts=[],actions=[],playerId=state.playerId??'lumen';next.playerId=playerId;next.turn+=1;next.lastTreatyEvents=[];next.lastForeignEvents=[];next.lastConflictEvents=[];next.lastMediationEvents=[];next.lastPeaceOfferEvents=[];next.lastPeaceComplianceEvents=[];
 if(action.id==='embargo')next.activePolicy='embargo';
 if(['balanced','reopen'].includes(action.id))next.activePolicy='open';
 if(action.id==='resilience')next.activePolicy='resilience';
 const event=eventForTurn(state.turn),matureAll=next.projects.filter(project=>project.dueTurn<=next.turn),mature=matureAll.filter(project=>!project.type||project.type==='facility'),matureSites=matureAll.filter(project=>project.type==='site');
 next.farmLevel=Math.min(3,next.farmLevel+mature.length);completeSiteProjects(next,matureSites);next.projects=next.projects.filter(project=>project.dueTurn>next.turn);
 next.countries[playerId].treasury-=action.cost;
 const projectCount=next.projects.length;applyDomestic(next,action,parts,actions);runCabinetFollowthrough(next,{parts,actions});applyJointInvestmentDecision(next,action,parts,actions);const newlyStarted=next.projects.slice(projectCount),started=structuredClone(newlyStarted.filter(project=>!project.type||project.type==='facility')),siteStarted=structuredClone(newlyStarted.filter(project=>project.type==='site'));applyRequest(next,action,parts,actions);applyNegotiation(next,action,parts,actions);applyTreatyDecision(next,action,parts,actions);
 applyConflictChoice(next,action,parts,actions);
 preparePeaceComplianceMediation(next,action);
 applyMediation(next,action,parts,actions);
 applyPeaceReply(next,action,parts,actions);
 applyPeaceComplianceResponse(next,action,actions);
 reconcilePeaceCompliance(next,actions);
 runPeaceResponses(next,state,actions);
 prepareGoalConflicts(next,state,parts,actions);
 runSiteEffects(next,{parts,actions});
 const foreignSiteSeed=prepareForeignSites(next,actions);
 const exportRevenue=produce(next,state,event,parts,actions);
 const goalWorld=Number.isSafeInteger(next.worldGoalStartTurn)&&next.turn>=next.worldGoalStartTurn;
 prepareForeignStrategies(next,state,action,actions);
 if(goalWorld)runForeignGoalPolicies(next,state,parts,actions);
 runTreaties(next,parts,actions);runForeignDiplomacy(next,actions);
 if(goalWorld)runGoalRelations(next,state,parts,actions);else runForeignActions(next,state,actions);
 runGoalConflicts(next,state,parts,actions);
 runPeaceOffers(next,state,actions);
 applyAgreements(next,parts,actions);
 const foreignSiteDevelopment=runForeignSiteDecisions(next,parts,actions,foreignSiteSeed);
 runJointInvestments(next,parts,actions);
 const diversifying=next.activePolicy==='embargo'||state.countries.nord.price>145||state.countries.nord.trust<42;
 next.marketShare=Math.round(Math.max(.25,Math.min(1,state.marketShare+(diversifying?-.12:.025)))*1000)/1000;
 finalizeCountries(next);if(goalWorld)finishForeignGoals(next,state,actions);updateRequests(next,actions);updateNegotiations(next,actions);updateMediations(next,actions);finishPeaceResponses(next,actions);runPeaceCompliance(next,state,actions);
 next.lastConflictEvents=actions.filter(item=>item.source==='goal_conflict').map(item=>({turn:next.turn,conflictId:item.conflictId??null,type:item.type,text:item.text,countryId:item.countryId,targetId:item.targetId,stance:item.stance??null,food:item.food??0,money:item.money??0}));
 const adjustment=next.countries[playerId].food-state.countries[playerId].food-parts.reduce((sum,part)=>sum+part.value,0);if(adjustment)parts.push({label:'재고 상·하한 조정',value:adjustment});
 const development={levelBefore:state.farmLevel,levelAfter:next.farmLevel,started,completed:structuredClone(mature),ongoing:structuredClone(next.projects.filter(project=>!project.type||project.type==='facility'))};
 const siteDevelopment={started:siteStarted,completed:structuredClone(matureSites),ongoing:structuredClone(next.projects.filter(project=>project.type==='site'))};
 return {next,event,mature,parts,actions,exportRevenue,diversifying,development,siteDevelopment,foreignSiteDevelopment};
}

function reason(countryId,metric,context){
 const related=context.actions.filter(item=>item.countryId===countryId||item.targetId===countryId).map(item=>item.text),player=countryId===context.playerId;
 if(metric==='food')return `기후·생산·소비·교역${player?'·국가 시설·협약':''}의 결과입니다. ${related.slice(0,2).join(' ')}`;
 if(metric==='treasury')return player?`선택한 조치 비용 −${context.action.cost}, 세입·운영비와 거래를 반영했습니다.`:`세입·운영비·거래 대금과 자국 결정을 반영했습니다. ${related.slice(0,2).join(' ')}`;
 if(metric==='price')return '최종 식량 재고에 따른 공급 가격과 기존 물가의 점진적 조정을 반영했습니다.';
 return `식량·물가·외교 관계와 자국 대응을 반영했습니다. ${related.slice(0,1).join(' ')}`;
}

export function advanceTurn(state,id){
 const playerId=state.playerId??'lumen',action=getAction({...state,playerId},id);
 if(!action)throw new Error(id==='invest'?`${PROFILES[playerId].facilityName}은 이미 건설 중이거나 최대 단계입니다.`:'알 수 없거나 만료·처리된 정책 또는 요청입니다.');
 if(state.countries[playerId].treasury<action.cost)throw new Error('국고가 부족합니다. 다른 정책을 선택하세요.');
 if(state.countries[playerId].food<action.foodCost)throw new Error('지원에 필요한 식량이 부족합니다.');
 const context={...simulate({...state,playerId},action),action,playerId},{next,event,mature,parts,actions,development,siteDevelopment,foreignSiteDevelopment}=context;
 const baselineState=simulate({...state,playerId},getAction({...state,playerId},'maintain')).next,baseline=baselineState.countries[playerId];
 const policyEffect=Object.fromEntries(['food','price','treasury','trust'].map(metric=>[metric,next.countries[playerId][metric]-baseline[metric]]));
 const policyRelationEffects=COUNTRY_IDS.filter(countryId=>countryId!==playerId).map(countryId=>{const key=[playerId,countryId].sort().join(':'),before=state.relations?.[key]??50,after=next.relations?.[key]??50,effect=after-(baselineState.relations?.[key]??50);return {countryId,before,after,effect};}).filter(item=>item.effect!==0);
 const changes=COUNTRY_IDS.flatMap(countryId=>['food','treasury','approval','price','trust'].filter(metric=>state.countries[countryId][metric]!==next.countries[countryId][metric]).map(metric=>({countryId,metric,before:state.countries[countryId][metric],after:next.countries[countryId][metric],reason:reason(countryId,metric,context)})));
 const foreign=actions.filter(item=>item.countryId!==playerId),country=COUNTRIES[playerId];
 const siteFeatureActive=Object.prototype.propertyIsEnumerable.call(state,'siteLevels')||Boolean(action.site)||siteDevelopment.started.length>0||siteDevelopment.completed.length>0||siteDevelopment.ongoing.length>0;
 const jointFeatureActive=Number.isSafeInteger(next.jointStartTurn)&&next.turn>=next.jointStartTurn&&(Boolean(action.jointInvestment)||Array.isArray(next.jointInvestments)||actions.some(item=>item.source==='joint_investment'));
 const causes=[
  {from:'기후',to:country.name,text:`${event.title}. ${country.name}의 기후와 생산 기반이 식량에 반영되었습니다.${mature.length?` ${PROFILES[playerId].facilityName}이 완공되었습니다.`:''}`},
  {from:country.name,to:'국내',text:`${action.name} 결정이 식량·국고·물가에 반영되었습니다.`},
  {from:'세계',to:'교역망',text:foreign.filter(item=>item.type==='trade').map(item=>item.text).join(' ')||'각국은 이번 분기의 재고와 예산을 바탕으로 교역을 유지했습니다.'},
  {from:'외국',to:country.name,text:actions.filter(item=>['request','agreement','expiry'].includes(item.type)).map(item=>item.text).join(' ')||'다른 나라들은 다음 협상 시점을 검토합니다.'},
 ];
 next.commands=[...(state.commands??[]),id];
 next.history=[...state.history,{turn:next.turn,playerId,policyId:id,actionLabel:action.name,actionCost:action.cost,development,...(siteFeatureActive?{siteDevelopment,siteOperations:actions.filter(item=>item.source==='site').map(item=>structuredClone(item))}:{}),...(foreignSiteDevelopment?{foreignSiteDevelopment,foreignSiteOperations:actions.filter(item=>item.source==='foreign_site').map(item=>structuredClone(item))}:{}),...(jointFeatureActive?{jointInvestmentEvents:actions.filter(item=>item.source==='joint_investment').map(item=>structuredClone(item))}:{}),eventTitle:event.title,headline:`${action.name} 결정을 실행했습니다. ${COUNTRY_IDS.length}개국이 기후와 재고에 대응했고, ${foreign.filter(item=>item.source==='autonomous'||item.source==='foreign_site'&&['upgrade','manage','trade'].includes(item.operation)||item.source==='national_goal'&&!['goal_achievement','request','cooperation'].includes(item.type)).length}건의 자율 행동이 실제 자원과 재정을 바꿨습니다.${mature.length?` ${PROFILES[playerId].facilityName}이 완공되었습니다.`:''}`,beforeCountries:structuredClone(state.countries),foodBreakdown:parts,policyEffect,policyRelationEffects,baselineLabel:'새 조치 없이 기존 정책 유지',changes,notableChanges:changes,causes,citizens:citizenStories(next.countries[playerId],next).map((story,index)=>({...story,before:citizenStories(state.countries[playerId],{...state,playerId})[index].text})),worldActions:actions,aiActions:foreign}].slice(-80);
 next.objectives=advanceObjectives(state,next,id);
 next.history.at(-1).objectiveAchievements=next.objectives.completed.filter(item=>item.turn===next.turn).map(item=>({...item,unlockName:getPolicies(next).find(policy=>policy.id===item.unlockId)?.name??null}));
 return next;
}

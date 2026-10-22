import {COUNTRIES} from './country-data.mjs?v=29';
import {PROFILES} from './nation-profiles.mjs?v=29';
import {SITE_DEFS} from './site-operations.mjs?v=29';
import {quarterDate} from './calendar.mjs?v=29';
import {escape,signed} from './render.mjs?v=29';
import {jointConstructionBenefit} from './construction-benefits.mjs?v=29';
import {cabinetResult} from './cabinet-ui.mjs?v=29';

const period=turn=>{
 const date=quarterDate(Math.max(0,turn-1));
 return `${date.year}년 ${date.quarter}분기`;
};

const metric=(before,after,effect)=>{
 const delta=after-before,policyEffect=Number.isFinite(effect)?effect:0;
 return {before,after,delta,policyEffect,remainder:delta-policyEffect};
};

const facilityName=(state,project)=>project?.type==='site'
 ? SITE_DEFS[project.siteKind]?.name??'지도 시설'
 : PROFILES[state.playerId]?.facilityName??'국가 시설';

function jointOutcome(state,last){
 const event=(last.jointInvestmentEvents??[]).find(item=>['accepted','rejected'].includes(item.operation));
 if(!event)return null;
 const country=COUNTRIES[event.countryId]?.name??'상대국',site=SITE_DEFS[event.kind]?.name??'공동 시설';
 if(event.operation==='rejected')return {actualCost:0,actualFood:0,costLabel:'실제 지출',outcome:`${country}의 ${site} 공동 투자 거절`,timing:null};
 const contract=(state.jointInvestments??[]).find(item=>item.id===event.contractId);
 const timing=contract?`${period(contract.dueTurn)} 완공 · ${jointConstructionBenefit(state,contract)} · ${period(contract.endTurn)} 계약 종료`:null;
 return {actualCost:Math.max(0,-Number(event.playerImpact?.treasury??0)),actualFood:0,costLabel:'실제 지출',outcome:`${country}의 ${site} 공동 투자 수락 · 공동 건설 시작`,timing};
}

function negotiationOutcome(state,last){
 const proposal=/^propose:([^:]+):([^:]+):/.exec(last.policyId),reply=/^reply:([^:]+):/.exec(last.policyId);
 if(!proposal&&!reply)return null;
 const record=[...(state.negotiations??[])].reverse().find(item=>reply?item.id===reply[1]:item.createdTurn===last.turn&&item.targetId===proposal[1]&&item.kind===proposal[2]);
 if(!record)return null;
 const status={accepted:'수락',countered:'역제안',rejected:'거절',declined:'거절'}[record.status]??'처리';
 const country=COUNTRIES[record.targetId]?.name??'상대국',actualCost=Math.max(0,-Number(record.settlement?.moneyDelta??0)),actualFood=Math.max(0,-Number(record.settlement?.foodDelta??0));
 return {actualCost,actualFood,costLabel:'실제 지급',outcome:`${country}와의 협상 ${status}`,timing:null};
}

function treatyOutcome(state,last){
 if(!/^(?:treaty:|break:)/.test(last.policyId))return null;
 const accepted=(state.lastTreatyEvents??[]).find(event=>event.turn===last.turn&&['accepted','rejected'].includes(event.type));
 const treaty=accepted&&(state.treaties??[]).find(item=>item.id===accepted.treatyId),settled=(state.lastTreatyEvents??[]).find(event=>event.turn===last.turn&&event.treatyId===treaty?.id&&['fulfilled','breach'].includes(event.type));
 if(!accepted)return null;
 const status=accepted.type==='accepted'?'수락':'거절',playerFunds=treaty?.kind==='trade_buy'||treaty?.kind==='alliance'&&settled?.actorId===state.playerId,actualCost=playerFunds?Number(settled?.money??0):0;
 const actualFood=treaty?.kind==='trade_sell'||treaty?.kind==='alliance'&&settled?.actorId===state.playerId?Number(settled?.food??0):0;
 return {actualCost,actualFood,costLabel:'실제 지급',outcome:`${COUNTRIES[accepted.targetId]?.name??'상대국'}의 장기 협정 ${status}`,timing:accepted.type==='accepted'&&treaty?`${period(treaty.endTurn-1)}까지 이행`:null};
}

function peaceOutcome(state,last){
 const compliance=/^peace-compliance:([^:]+):(sanction|renegotiate)/.exec(last.policyId);
 if(compliance){
  const event=(state.lastPeaceComplianceEvents??[]).find(item=>item.turn===last.turn&&item.accordId===compliance[1]);
  if(!event)return null;
  const costs=event.costs??{food:0,money:0},outcome=compliance[2]==='sanction'?'합의 위반에 재제재 실행':'합의 위반 재협상 처리';
  return {actualCost:Number(costs.money??0),actualFood:Number(costs.food??0),costLabel:'실제 지급',outcome,timing:null};
 }
 if(!/^(?:mediate:|mediate-accept:|peace-reply:|peace-counter:)/.test(last.policyId))return null;
 const offer=(state.peaceOffers??[]).find(item=>item.reply?.command===last.policyId),record=offer
  ? (state.mediations??[]).find(item=>item.id===offer.reply?.mediationRecordId)
  : (()=>{const accepted=/^mediate-accept:([^:]+)$/.exec(last.policyId),started=/^mediate:([^:]+):/.exec(last.policyId);return [...(state.mediations??[])].reverse().find(item=>item.turn===last.turn&&(accepted?item.id===accepted[1]:!started||item.conflictId===started[1]));})();
 if(!record&&!offer)return null;
 const status=offer?.reply?.outcome??record?.status??'rejected',costs=offer?.reply?.costs??record?.costs??{food:0,money:0};
 const label={accepted:'수락',countered:'역제안',rejected:'거절',escalated:'결렬',declined:'거절'}[status]??'처리';
 return {actualCost:Number(costs.money??0),actualFood:Number(costs.food??0),costLabel:'실제 지급',outcome:`평화·제재 완화 합의 ${label}`,timing:null};
}

function actionSummary(state,last){
 const cabinet=cabinetResult(state,last);if(cabinet)return cabinet;
 const joint=jointOutcome(state,last);
 if(joint)return {label:last.actionLabel,...joint};
 const negotiation=negotiationOutcome(state,last);
 if(negotiation)return {label:last.actionLabel,...negotiation};
 const treaty=treatyOutcome(state,last);
 if(treaty)return {label:last.actionLabel,...treaty};
 const peace=peaceOutcome(state,last);
 if(peace)return {label:last.actionLabel,...peace};
 const siteEvent=(last.siteOperations??[]).find(item=>item.operation==='upgrade'||item.operation==='manage');
 const started=[...(last.development?.started??[]),...(last.siteDevelopment?.started??[])][0];
 if(siteEvent){
  const timing=siteEvent.operation==='upgrade'&&started?`${period(started.dueTurn)} 완공 예정 · ${SITE_DEFS[siteEvent.kind].benefit}`:null;
  const impact=Number(siteEvent.money),actualCost=Number.isFinite(impact)?Math.max(0,-impact):Math.max(0,Number(last.actionCost??0));
  return {label:last.actionLabel,actualCost,actualFood:0,costLabel:'실제 지출',outcome:siteEvent.operation==='upgrade'?'현장 착공 완료':'현장 운영 완료',timing};
 }
 if(started)return {label:last.actionLabel,actualCost:Math.max(0,Number(last.actionCost??0)),actualFood:0,costLabel:'실제 지출',outcome:`${facilityName(state,started)} 착공`,timing:`${period(started.dueTurn)}부터 단계 생산 +4/분기`};
 return {label:last.actionLabel,actualCost:Math.max(0,Number(last.actionCost??0)),actualFood:0,costLabel:'명령 비용',outcome:'명령 실행 완료',timing:null};
}

function projectEvents(state,last){
 const rows=[];
 for(const project of [...(last.development?.completed??[]),...(last.siteDevelopment?.completed??[])])rows.push({kind:'completed',title:`${facilityName(state,project)} 완공`,detail:`${period(last.turn)}부터 실제 운영 반영`});
 return rows;
}

function policyEvents(state,last){
 const rows=[],playerId=state.playerId??'lumen',before=last.beforeCountries?.[playerId],after=state.countries?.[playerId];
 if(before&&after&&last.policyEffect?.trust)rows.push({kind:'policy',title:'외교 신뢰',detail:`${before.trust} → ${after.trust} · 유지 대비 ${signed(last.policyEffect.trust)}`});
 const relations=[...(last.policyRelationEffects??[])].sort((a,b)=>Math.abs(b.effect)-Math.abs(a.effect)).slice(0,2);
 for(const item of relations)rows.push({kind:'policy',title:`${COUNTRIES[item.countryId]?.name??'상대국'} 관계`,detail:`${item.before} → ${item.after} · 유지 대비 ${signed(item.effect)}`});
 return rows;
}

function canonicalEvents(state,last){
 const rows=[...policyEvents(state,last),...projectEvents(state,last)],joint=last.jointInvestmentEvents??[];
 for(const event of last.siteOperations??[]){
  if(event.operation!=='manage')continue;
  rows.push({kind:'site',title:SITE_DEFS[event.kind]?.name??'국내 현장',detail:event.text??'현장 운영 결과가 반영됐습니다.'});
 }
 for(const event of joint){
  if(!['settlement','suspended','resumed','completed'].includes(event.operation))continue;
  const country=COUNTRIES[event.countryId]?.name??'상대국',site=SITE_DEFS[event.kind]?.name??'공동 시설';
  rows.push({kind:event.operation,title:`${country} · ${site}`,detail:event.text??event.reason??'공동 투자 상태가 바뀌었습니다.'});
 }
 const commandSource=/^(?:propose:|reply:)/.test(last.policyId)?'negotiation':/^(?:peace-reply:|peace-counter:)/.test(last.policyId)?'peace_offer':null;
 for(const event of last.worldActions??[]){
  if(event.source!==commandSource||!event.text||event.countryId!==state.playerId&&event.targetId!==state.playerId)continue;
  rows.push({kind:'diplomacy',title:'외교·협상 결과',detail:event.text});
 }
 if(/^(?:treaty:|break:)/.test(last.policyId))for(const event of state.lastTreatyEvents??[])if(event.turn===last.turn&&['fulfilled','breach','standby','broken'].includes(event.type))rows.push({kind:'treaty',title:'장기 협정 결과',detail:event.text});
 if(/^(?:mediate:|mediate-accept:)/.test(last.policyId))for(const event of state.lastMediationEvents??[])if(event.turn===last.turn)rows.push({kind:'peace',title:'평화·제재 완화 결과',detail:event.text});
 const compliance=/^peace-compliance:([^:]+):/.exec(last.policyId);
 if(compliance)for(const event of state.lastPeaceComplianceEvents??[])if(event.turn===last.turn&&event.accordId===compliance[1])rows.push({kind:'peace',title:'합의 위반 대응',detail:event.text??'대응 결과가 반영됐습니다.'});
 const seen=new Set();
 return rows.filter(item=>{const key=`${item.kind}:${item.title}:${item.detail}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,3);
}

export function resultCauses(state){
 const last=state.history?.at(-1),playerId=state.playerId??'lumen',before=last?.beforeCountries?.[playerId],after=state.countries?.[playerId];
 if(!last||!before||!after)return null;
 return {
  turn:last.turn,
  period:period(last.turn),
  comparisonLabel:'기존 정책 유지 대비 차이',
  remainderLabel:'그 밖의 분기 변화',
  action:actionSummary(state,last),
  metrics:{
   food:metric(before.food,after.food,last.policyEffect?.food),
   treasury:metric(before.treasury,after.treasury,last.policyEffect?.treasury),
  },
  events:canonicalEvents(state,last),
 };
}

const amount=(value,unit='')=>`${signed(value)}${unit}`;
const totalRow=(label,item,unit='')=>`<div data-cause-metric="${label==='식량'?'food':'treasury'}"><span>${label}</span><b>${item.before}${unit} → ${item.after}${unit}</b><strong>${amount(item.delta,unit)}</strong><small><i>명령 차이</i> ${amount(item.policyEffect,unit)} · <i>나머지</i> ${amount(item.remainder,unit)}</small></div>`;
const equation=(label,item,unit='')=>`<div><span>${label}</span><small><b>명령 차이</b> ${amount(item.policyEffect,unit)} + <b>나머지</b> ${amount(item.remainder,unit)} = <b>총변화</b> ${amount(item.delta,unit)}</small></div>`;

export function renderResultCauses(state){
 const model=resultCauses(state);
 if(!model)return '';
 const events=model.events.length?`<ul class="cause-events">${model.events.map(event=>`<li data-cause-event="${escape(event.kind)}"><strong>${escape(event.title)}</strong><span>${escape(event.detail)}</span></li>`).join('')}</ul>`:'';
 const timing=model.action.timing?`<p class="cause-timing"><span>다음 변화</span><strong>${escape(model.action.timing)}</strong></p>`:'';
 const payment=model.action.actualFood?`${escape(model.action.costLabel)} 식량 ${model.action.actualFood} · 국고 ${model.action.actualCost}억`:`${escape(model.action.costLabel)} ${model.action.actualCost}억`;
 return `<section class="result-causes" data-result-causes aria-labelledby="result-causes-title"><header><span>${escape(model.period)} · 결정과 결과</span><h3 id="result-causes-title">내 결정이 만든 결과</h3></header><div class="cause-decision"><span>실행</span><strong>${escape(model.action.label)}</strong><b>${payment}</b><p>${escape(model.action.outcome)}</p></div>${timing}<div class="cause-totals" data-cause-totals>${totalRow('식량',model.metrics.food)}${totalRow('국고',model.metrics.treasury,'억')}</div><p class="cause-comparison-note">명령 차이는 같은 상황에서 기존 정책을 유지했을 때와 비교한 값입니다.</p>${events}<details class="cause-reconciliation"><summary>정확한 계산 보기</summary><p><b>${escape(model.comparisonLabel)}</b>는 같은 세계에서 새 명령 없이 기존 정책을 유지했을 때와 비교한 반사실 값이며 직접 거래액 전체를 뜻하지 않습니다.</p><div>${equation('식량',model.metrics.food)}${equation('국고',model.metrics.treasury,'억')}</div><small>${escape(model.remainderLabel)}에는 생산·소비·교역·협정·재고 상한 조정을 합친 나머지가 들어갑니다.</small></details></section>`;
}

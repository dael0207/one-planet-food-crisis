import {PROFILES} from './engine.mjs?v=29';
import {escape,signed} from './render.mjs?v=29';

const MAX_LEVEL=3;
const isOwn=(project,playerId)=>Boolean(project)&&(!project.type||project.type==='facility')&&(!project.countryId||project.countryId===playerId);
const completionLabel=turn=>`${2031+Math.floor((turn-1)/4)}년 ${(turn-1)%4+1}분기 · ${turn}분기 결과`;

function developmentState(state){
 const last=state.history?.at(-1)??{},playerId=state.playerId??'lumen',metadata=last.development;
 const currentProjects=(state.projects??[]).filter(project=>isOwn(project,playerId));
 if(metadata){
  const started=(metadata.started??[]).find(project=>isOwn(project,playerId));
  const completed=(metadata.completed??[]).find(project=>isOwn(project,playerId));
  const ongoing=(metadata.ongoing??[]).find(project=>isOwn(project,playerId))??currentProjects[0];
  if(completed)return {stage:'completed',project:completed,level:completed.level??metadata.levelAfter??state.farmLevel};
  if(started)return {stage:'started',project:started,level:started.level??Math.min(MAX_LEVEL,(metadata.levelBefore??state.farmLevel)+1)};
  if(ongoing)return {stage:'building',project:ongoing,level:ongoing.level??Math.min(MAX_LEVEL,(metadata.levelBefore??state.farmLevel)+1)};
 }
 const project=currentProjects[0];
 if(project)return {stage:last.policyId==='invest'?'started':'building',project,level:project.level??Math.min(MAX_LEVEL,(state.farmLevel??0)+1),legacy:true};
 if((state.farmLevel??0)>0)return {stage:'operating',level:state.farmLevel,legacy:true};
 return null;
}

function timeline(stage,remaining){
 const completed=stage==='completed'||stage==='operating';
 const active=completed?3:remaining<=1?2:remaining<=2?1:0;
 return `<ol class="development-timeline" aria-label="시설 건설 단계"><li class="${active>=0?'done':''}"><span>착공</span></li><li class="${active>=1?'done':''}"><span>2분기 남음</span></li><li class="${active>=2?'done':''}"><span>1분기 남음</span></li><li class="${active>=3?'done':''}"><span>완공</span></li></ol>`;
}

export function renderDevelopment(state){
 const view=developmentState(state);
 if(!view)return '';
 const last=state.history?.at(-1)??{},profile=PROFILES[state.playerId??'lumen'];
 const remaining=view.project?Math.max(0,view.project.dueTurn-state.turn):0;
 const facilityPart=(last.foodBreakdown??[]).find(part=>part.label?.startsWith('국가 생산 시설'));
 const contribution=facilityPart?.value??0,base=(state.farmLevel??0)*4;
 const status=view.stage==='completed'?'운영 시작':view.stage==='operating'?'운영 중':`건설 중 · ${remaining}분기 남음`;
 const title=view.stage==='completed'?`${profile.facilityName} ${view.level}단계 완공`:view.stage==='operating'?`${profile.facilityName} ${view.level}단계 운영 중`:view.stage==='started'?`${profile.facilityName} ${view.level}단계 착공 완료`:`${profile.facilityName} ${view.level}단계 건설 중`;
 const targetTotal=view.level*4;
 const benefit=view.stage==='started'||view.stage==='building'?`완공 뒤 추가 생산 <b>+4/분기</b><span>완공 뒤 시설 총 +${targetTotal}/분기</span>`:view.stage==='completed'?`운영 시작 <b>+4/분기</b><span>시설 총 기본 생산 +${base}/분기</span>`:`시설 총 기본 생산 <b>+${base}/분기</b>`;
 const due=view.project?`<span>${view.stage==='completed'?'완공 시점':'완공 예정'} <b>${completionLabel(view.project.dueTurn)}</b></span>`:'';
 const cost=view.stage==='started'&&Number.isFinite(last.actionCost)&&last.actionCost>0?`<span>이번 분기 실제 지출 <b>${last.actionCost}억</b></span>`:'';
 const actual=contribution?`<span>이번 분기 시설 생산 <b>${signed(contribution)}</b></span>`:'';
 const cap=state.farmLevel>=MAX_LEVEL?'최대 3단계 운영 중':'총 3단계가 최대';
 return `<section class="development-panel" data-development-stage="${view.stage}" aria-labelledby="development-title"><header><div><span class="eyebrow">국가 개발 성과</span><h3 id="development-title">${escape(title)}</h3></div><strong class="development-status">${status}</strong></header><div class="development-benefit">${benefit}<small>${cap}</small></div><div class="development-facts">${cost}${due}${actual}</div>${timeline(view.stage,remaining)}<p>시설의 +4는 단계별 기본 생산입니다. 최종 식량 재고는 기후·소비·교역까지 합산해 달라집니다.</p></section>`;
}

import {SITE_DEFS} from './site-operations.mjs?v=30';
import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=30';

const METRICS={food:['식량','점'],treasury:['국고','억'],price:['생활물가','지수']};
const PAGE_SIZE=8,MAX_CHART_POINTS=120;
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const known=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value));
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const shown=(value,suffix='')=>known(value)?`${Number(value)}${suffix}`:'기록 없음';
const signed=value=>`${number(value)>0?'+':''}${number(value)}`;
const quarter=turn=>turn===0?'운영 시작':`${2031+Math.floor((turn-1)/4)}년 ${((turn-1)%4)+1}분기`;

export function normalizeChronicleOptions(model,options={}){
 const points=Array.isArray(model?.points)?model.points:[],last=points.at(-1)?.turn??0;
 const period=[12,40,'all'].includes(options.period)?options.period:12;
 const metric=Object.hasOwn(METRICS,options.metric)?options.metric:'food';
 const partners=COUNTRY_IDS.filter(id=>id!==model?.playerId),partner=partners.includes(options.partner)?options.partner:partners[0];
 const turns=new Set(points.map(point=>point.turn)),turn=turns.has(Number(options.turn))?Number(options.turn):last;
 const filter=['investment','relations'].includes(options.filter)?options.filter:'all';
 const filtered=points.filter(point=>point.turn>0).filter(point=>filter==='all'||filter==='investment'?(filter==='all'||isInvestment(point)):isRelation(point));
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),page=Math.min(pages-1,Math.max(0,Math.trunc(number(options.page))));
 return {period,metric,partner,turn,filter,page,pages};
}

const hasStarted=point=>Boolean(point.development?.started?.length||point.siteDevelopment?.started?.length);
const hasCompleted=point=>Boolean(point.development?.completed?.length||point.siteDevelopment?.completed?.length);
const isInvestment=point=>number(point.investmentCost)>0||hasStarted(point)||hasCompleted(point);
const isRelation=point=>(point.relationEffects??[]).some(item=>number(item.delta)!==0);
function windowPoints(points,period,selectedTurn){
 if(period==='all')return points;
 const index=Math.max(0,points.findIndex(point=>point.turn===selectedTurn));
 return points.slice(Math.max(0,index-period+1),index+1);
}
function sampled(points,selectedTurn,value){
 if(points.length<=MAX_CHART_POINTS)return points;
 const knownPoints=points.filter(point=>known(value(point))),mandatory=[points[0],points.at(-1),points.find(point=>point.turn===selectedTurn)];
 if(knownPoints.length){mandatory.push(knownPoints.reduce((best,point)=>Number(value(point))<Number(value(best))?point:best));mandatory.push(knownPoints.reduce((best,point)=>Number(value(point))>Number(value(best))?point:best))}
 const result=mandatory.filter(Boolean),remaining=MAX_CHART_POINTS-new Set(result.map(point=>point.turn)).size;
 for(let index=0;index<remaining;index++)result.push(points[Math.round(index*(points.length-1)/Math.max(1,remaining-1))]);
 return [...new Map(result.map(point=>[point.turn,point])).values()].sort((a,b)=>a.turn-b.turn);
}
function controlButton(action,key,value,current,label){return `<button type="button" data-action="${action}" data-${key}="${value}" aria-pressed="${current===value}">${label}</button>`}
function controls(model,options){
 const partners=COUNTRY_IDS.filter(id=>id!==model.playerId);
 return `<div class="chronicle-controls"><fieldset><legend>표시 기간</legend><div class="chronicle-segments">${controlButton('chronicle-period','period','12',String(options.period),'최근 12분기')}${controlButton('chronicle-period','period','40',String(options.period),'최근 40분기')}${controlButton('chronicle-period','period','all',String(options.period),'전체')}</div></fieldset><label>국가 지표<select name="chronicle-metric">${Object.entries(METRICS).map(([id,[label]])=>`<option value="${id}"${options.metric===id?' selected':''}>${label}</option>`).join('')}</select></label><label>관계 상대국<select name="chronicle-partner">${partners.map(id=>`<option value="${id}"${options.partner===id?' selected':''}>${escape(COUNTRIES[id].name)}</option>`).join('')}</select></label><label>상세 분기<select name="chronicle-quarter">${model.points.map(point=>`<option value="${point.turn}"${options.turn===point.turn?' selected':''}>${escape(quarter(point.turn))}</option>`).join('')}</select></label></div>`;
}
function chart(points,{value,label,unit,selectedTurn,className}){
 const allValues=points.map(value).filter(known),visible=sampled(points,selectedTurn,value),min=allValues.length?Math.min(...allValues):0,max=allValues.length?Math.max(...allValues):0,low=min===max?Math.max(0,min-1):min,high=min===max?max+1:max;
 const firstTurn=visible[0]?.turn??0,lastTurn=visible.at(-1)?.turn??firstTurn,xTurn=turn=>44+((turn-firstTurn)/Math.max(1,lastTurn-firstTurn))*692,y=item=>22+(high-Number(value(item)))/(high-low)*154;
 let drawing=false;const path=visible.map(item=>{if(!known(value(item))){drawing=false;return''}const command=drawing?'L':'M';drawing=true;return`${command}${xTurn(item.turn).toFixed(1)} ${y(item).toFixed(1)}`}).join(' '),selected=visible.findIndex(item=>item.turn===selectedTurn);
 const ticks=[0,Math.floor((visible.length-1)/2),visible.length-1].filter((item,index,array)=>item>=0&&array.indexOf(item)===index);
 const selectedKnown=selected>=0&&known(value(visible[selected]));
 const milestones=className==='is-facility'?points.filter(point=>hasStarted(point)||hasCompleted(point)).slice(-16):[];
 const denseMilestones=lastTurn-firstTurn>24;
 const markers=milestones.map((point,index)=>{const start=hasStarted(point),label=start?'착공':'완공',x=xTurn(point.turn);return `<g class="chart-milestone ${start?'is-start':'is-complete'}"><title>${quarter(point.turn)} ${label}</title><line x1="${x}" y1="22" x2="${x}" y2="176"/>${denseMilestones?'':`<text x="${x}" y="${index%2?58:42}" text-anchor="${x>690?'end':x<90?'start':'middle'}">${label}</text>`}</g>`}).join('');
 const selectedX=selected>=0?xTurn(visible[selected].turn):0;
 const summary=points.length>MAX_CHART_POINTS?` · ${points.filter(point=>point.turn>0).length}분기를 최대 ${MAX_CHART_POINTS}개 점으로 요약 표시`:'';
 return `<figure class="chronicle-chart ${className}"><figcaption><strong>${escape(label)}</strong><span>선택 ${selectedKnown?escape(`${value(visible[selected])}${unit}`):'기록 없음'}</span></figcaption><svg viewBox="0 0 780 220" role="img" aria-label="${escape(label)}. ${allValues.length?`최저 ${min}${escape(unit)}, 최고 ${max}${escape(unit)}.`:'이 기간의 과거 수치는 기록되지 않았습니다.'}${summary}"><line class="chart-axis" x1="44" y1="176" x2="736" y2="176"/><line class="chart-grid" x1="44" y1="22" x2="736" y2="22"/><line class="chart-grid" x1="44" y1="99" x2="736" y2="99"/><text x="38" y="27" text-anchor="end">${allValues.length?high:'—'}</text><text x="38" y="181" text-anchor="end">${allValues.length?low:'—'}</text>${markers}<path class="chart-line" d="${path}"/>${selected>=0?`<line class="chart-selected" x1="${selectedX}" y1="18" x2="${selectedX}" y2="176"/>${selectedKnown?`<circle class="chart-point" cx="${selectedX}" cy="${y(visible[selected])}" r="5"/>`:''}`:''}${ticks.map(index=>`<text x="${xTurn(visible[index].turn)}" y="204" text-anchor="${index===0?'start':index===visible.length-1?'end':'middle'}">${escape(quarter(visible[index].turn).replace('년 ','·').replace('분기','Q'))}</text>`).join('')}</svg>${className==='is-facility'?`<p class="chronicle-chart-note">점선: 착공·완공 ${milestones.length}건 · 날짜는 연대기에서 확인</p>`:''}${summary?`<p class="chronicle-chart-note">${escape(summary.slice(3))}. 상세 분기로 정확한 수치를 확인하세요.</p>`:''}</figure>`;
}
function summary(model,selected){
 const last=model.points.at(-1)??{},cost=last.cumulativeInvestmentCost,production=last.cumulativeFacilityProduction,level=last.facilityLevel,prefix=model.coverage==='partial'?'기록 범위 ':'';
 return `<div class="chronicle-summary"><div><span>${prefix}시설 누적 지출</span><b>${shown(cost,'억')}</b><small>시설 착공에 실제 사용</small></div><div><span>${prefix}시설 누적 생산</span><b>${shown(production)}</b><small>완공 뒤 실제 생산 합계</small></div><div><span>${last.siteLevels?'국가 사업 시설':'현재 시설'}</span><b>${shown(level,'단계')}</b><small>${known(level)?`기본 생산 +${Number(level)*4}/분기`:'과거 기록으로 확인 불가'}</small></div><div><span>${model.coverage==='partial'?'전체 운영':'기록된 운영'}</span><b>${number(model.totalTurns)}분기</b><small>${model.coverage==='partial'?`보유 기록 ${model.points.filter(point=>point.turn>0).length}분기 · `:''}선택한 분기 ${escape(quarter(selected.turn))}</small></div></div>`;
}
function developmentDetail(point){
 const parts=[],started=point.development?.started??[],ongoing=point.development?.ongoing??[],completed=point.development?.completed??[],project=started[0]??ongoing[0];
 if(started.length)parts.push(`시설 ${number(point.development.levelBefore)+1}단계 착공 · 실제 지출 ${number(point.investmentCost)}억`);
 if(project?.dueTurn){const remaining=Math.max(0,number(project.dueTurn)-number(point.turn));parts.push(`완공 예정 ${quarter(project.dueTurn)} · ${remaining}분기 남음`);parts.push('완공 뒤 기본 생산 +4/분기')}
 if(point.development?.completed?.length)parts.push(`시설 ${number(point.development.levelAfter)}단계 완공 · 기본 생산 +${number(point.development.levelAfter)*4}/분기`);
 if(ongoing.length&&!started.length)parts.unshift(`건설 중 ${ongoing.length}건`);
 const local=point.siteDevelopment??{},seen=new Set();
 for(const [stage,label]of [['started','착공'],['completed','완공'],['ongoing','건설 중']])for(const project of local[stage]??[]){
  if(seen.has(project.siteKind)||!SITE_DEFS[project.siteKind])continue;seen.add(project.siteKind);
  parts.push(SITE_DEFS[project.siteKind].name+' '+number(project.level)+'단계 '+label+(stage==='ongoing'?' · '+Math.max(0,project.dueTurn-point.turn)+'분기 남음':''));
 }
 for(const [kind,level]of Object.entries(point.siteLevels??{}))if(level>0&&!seen.has(kind)&&SITE_DEFS[kind])parts.push(SITE_DEFS[kind].name+' '+number(level)+'단계 운영');
 if(!parts.length&&number(point.facilityLevel)>0)parts.push(`시설 ${number(point.facilityLevel)}단계 운영 중 · 기본 생산 +${number(point.facilityLevel)*4}/분기`);
 if(!parts.length)parts.push(known(point.facilityLevel)?'운영 중인 시설 없음':'시설 운영 기록 없음');
 return parts.length?`<section><h4>${completed.length?'투자 성과':'투자 이정표'}</h4>${parts.map(text=>`<p>${escape(text)}</p>`).join('')}<p>이번 분기 시설 실제 생산 <b>+${number(point.facilityProduction)}</b></p></section>`:'';
}
function objectiveDetail(point){
 const achievements=point.objectiveAchievements??[];
 return achievements.length?`<section><h4>국가 목표 달성</h4>${achievements.map(item=>`<p><span>${number(item.stage)}단계</span><b>${escape(item.title)}</b></p>${item.unlockName?`<small>해금 · ${escape(item.unlockName)}</small>`:''}`).join('')}</section>`:'';
}
function selectedDetail(point,partner,previous){
 const metrics=point.metrics??{},before=point.beforeMetrics??metrics,effect=point.policyEffect??{};
 const selectedEffect=(point.relationEffects??[]).find(item=>item.countryId===partner),relationBefore=selectedEffect?.before??previous?.relations?.[partner],relationAfter=selectedEffect?.after??point.relations?.[partner],delta=known(relationBefore)&&known(relationAfter)?Number(relationAfter)-Number(relationBefore):null;
 const otherRows=(point.relationEffects??[]).filter(item=>item.countryId!==partner).map(item=>`<li><b>${escape(COUNTRIES[item.countryId]?.name??item.countryId)}</b><span>${number(item.before)} → ${number(item.after)} (${signed(item.delta)})</span><small>같은 세계에서 유지 대비 ${signed(item.policyEffect)}</small></li>`).join('');
 const relationSection=`<section><h4>선택한 국가 관계 · ${escape(COUNTRIES[partner]?.name??partner)}</h4><p><span>분기 전 → 분기 후</span><b>${shown(relationBefore)} → ${shown(relationAfter)}${known(delta)?` (${signed(delta)})`:''}</b></p><small>${selectedEffect?`같은 세계에서 유지 대비 ${signed(selectedEffect.policyEffect)}`:'이 분기에 기록된 직접 관계 효과 없음'}</small>${otherRows?`<ul class="chronicle-relation-list">${otherRows}</ul>`:''}</section>`;
 return `<article class="chronicle-detail"><header><span class="eyebrow">${escape(quarter(point.turn))} · ${escape(point.eventTitle||'분기 운영')}</span><h3>${escape(point.actionLabel||'운영 시작')}</h3></header><div class="chronicle-detail-grid"><section><h4>국가 총변화</h4>${[['food','식량'],['treasury','국고'],['price','물가'],['trust','외교 신뢰'],['approval','정책 지지도']].map(([id,label])=>`<p><span>${label}</span><b>${number(before[id])} → ${number(metrics[id])} (${signed(number(metrics[id])-number(before[id]))})</b></p>`).join('')}</section><section><h4>같은 세계에서 정책 직접 효과</h4><p><span>식량</span><b>${signed(effect.food)}</b></p><p><span>국고</span><b>${signed(effect.treasury)}억</b></p><p><span>물가</span><b>${signed(effect.price)}</b></p><p><span>외교 신뢰</span><b>${signed(effect.trust)}</b></p><small>날씨·교역·협정 변화와 분리한 유지 정책 대비 값입니다.</small></section>${objectiveDetail(point)}${developmentDetail(point)}${relationSection}</div>${(point.worldEvents??[]).length?`<details><summary>같은 분기의 세계 변화 ${point.worldEvents.length}건</summary>${point.worldEvents.map(text=>`<p>${escape(text)}</p>`).join('')}</details>`:''}</article>`;
}
function table(point,options){
 const partner=COUNTRIES[options.partner]?.name??options.partner,relation=point.relations?.[options.partner];
 return `<details class="chronicle-data"><summary>선택 분기 수치 표로 보기</summary><table><caption>${escape(quarter(point.turn))} 실제 기록</caption><thead><tr><th>식량</th><th>국고</th><th>물가</th><th>국가 사업 단계</th><th>시설 생산</th><th>${escape(partner)} 관계</th></tr></thead><tbody><tr><td>${shown(point.metrics?.food)}</td><td>${shown(point.metrics?.treasury,'억')}</td><td>${shown(point.metrics?.price)}</td><td>${shown(point.facilityLevel)}</td><td>${known(point.facilityProduction)?`+${point.facilityProduction}`:'기록 없음'}</td><td>${shown(relation)}</td></tr></tbody></table></details>`;
}
function timelineBadges(point){
 const badges=[];if(hasStarted(point))badges.push('착공');if(hasCompleted(point))badges.push('완공');
 for(const achievement of point.objectiveAchievements??[])badges.push(`국가 목표 ${number(achievement.stage)}단계`);
 if(isRelation(point))badges.push(`관계 변화 ${point.relationEffects.filter(item=>number(item.delta)!==0).length}개국`);return badges.join(' · ');
}
function timeline(model,options){
 const all=model.points.filter(point=>point.turn>0).filter(point=>options.filter==='all'||options.filter==='investment'&&isInvestment(point)||options.filter==='relations'&&isRelation(point));
 const pages=Math.max(1,Math.ceil(all.length/PAGE_SIZE)),page=Math.min(options.page,pages-1),items=all.slice().reverse().slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 const filters=`<div class="chronicle-segments" role="group" aria-label="기록 필터">${controlButton('chronicle-filter','filter','all',options.filter,'전체')}${controlButton('chronicle-filter','filter','investment',options.filter,'투자')}${controlButton('chronicle-filter','filter','relations',options.filter,'관계 변화')}</div>`;
 const cards=items.length?items.map(point=>`<button type="button" class="chronicle-entry${point.turn===options.turn?' is-selected':''}" data-action="chronicle-turn" data-turn="${point.turn}" aria-pressed="${point.turn===options.turn}"><span>${escape(quarter(point.turn))}</span><strong>${escape(point.actionLabel||'운영 결정')}</strong><small>${escape(point.eventTitle||'세계 상황')}</small><i>${escape(timelineBadges(point))}</i></button>`).join(''):`<p class="chronicle-filter-empty">이 조건에 해당하는 기록이 없습니다. 전체 연대기는 그대로 보존됩니다.</p>`;
 return `<section class="chronicle-timeline"><div class="chronicle-section-head"><div><span class="eyebrow">DECISION TIMELINE</span><h3>결정 연대기</h3></div>${filters}</div><div class="chronicle-entries">${cards}</div><nav class="chronicle-pages" aria-label="결정 기록 페이지"><button type="button" data-action="chronicle-page" data-page="${page-1}" ${page<=0?'disabled':''}>이전</button><span>${page+1} / ${pages}</span><button type="button" data-action="chronicle-page" data-page="${page+1}" ${page>=pages-1?'disabled':''}>다음</button></nav></section>`;
}

export function renderChronicle(model,rawOptions={}){
 const points=Array.isArray(model?.points)?model.points:[];
 if(!points.some(point=>point.turn>0))return `<section class="chronicle chronicle-empty"><span class="eyebrow">OPERATIONS RECORD</span><h2>첫 결정을 내리면 기록이 시작됩니다.</h2><p>결정 뒤부터 국가 지표, 투자 성과와 국가 관계 변화를 분기별로 확인할 수 있습니다.</p><button type="button" class="secondary-button" data-action="show-view" data-view="decision">이번 결정으로 돌아가기</button></section>`;
 const options=normalizeChronicleOptions(model,rawOptions),selected=points.find(point=>point.turn===options.turn)??points.at(-1),window=windowPoints(points,options.period,selected.turn);
 const charts=`<div class="chronicle-chart-grid">${chart(window,{value:p=>known(p.metrics?.[options.metric])?Number(p.metrics[options.metric]):null,label:`${COUNTRIES[model.playerId]?.name??'내 나라'} ${METRICS[options.metric][0]} 추이`,unit:METRICS[options.metric][1],selectedTurn:selected.turn,className:'is-national'})}${chart(window,{value:p=>known(p.facilityProduction)?Number(p.facilityProduction):null,label:'시설 실제 생산 추이',unit:' 식량',selectedTurn:selected.turn,className:'is-facility'})}${chart(window,{value:p=>known(p.relations?.[options.partner])?Number(p.relations[options.partner]):null,label:`${COUNTRIES[options.partner]?.name??'상대국'}와의 관계`,unit:'점',selectedTurn:selected.turn,className:'is-relation'})}</div>`;
 const previous=points[points.findIndex(point=>point.turn===selected.turn)-1];
 return `<section class="chronicle"><header class="chronicle-hero"><div><span class="eyebrow">OPERATIONS RECORD · ${escape(COUNTRIES[model.playerId]?.roleLabel??'운영국')}</span><h2>${escape(COUNTRIES[model.playerId]?.name??'내 나라')}, 결정이 만든 흐름</h2><p>총변화와 정책의 직접 효과를 나눠 보고, 투자와 외교가 여러 분기에 남긴 결과를 확인하세요.</p>${model.coverage==='partial'?`<p class="chronicle-coverage"><b>${escape(quarter(model.startTurn??points[0].turn))}부터의 기록</b>입니다. 저장되지 않은 이전 관계·시설 수치는 추정하지 않습니다.</p>`:''}</div><button type="button" class="secondary-button" data-action="show-view" data-view="decision">이번 결정으로 돌아가기</button></header>${summary(model,selected)}${controls(model,options)}${charts}${table(selected,options)}${selectedDetail(selected,options.partner,previous)}${timeline(model,options)}</section>`;
}

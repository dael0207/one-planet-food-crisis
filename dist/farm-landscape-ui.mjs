import {farmLandscape} from './farm-landscape.mjs?v=30';
import {quarterDate} from './calendar.mjs?v=30';
import {escape} from './render.mjs?v=30';

const date=turn=>{const value=quarterDate(Math.max(0,turn-1));return `${value.year}년 ${value.quarter}분기`;};
const signed=value=>`${value>0?'+':value<0?'−':''}${Math.abs(value)}`;
export function farmStatusLabel(landscape){
 if(landscape.climateTurn===null)return '관측 전';
 if(landscape.phase==='drought')return '가뭄 진행';
 if(landscape.phase==='recovering')return landscape.recoveryElapsed===1?'회복 초반':landscape.recoveryElapsed===2?'회복 진행':'회복 막바지';
 return landscape.lastDroughtTurn===null?'가뭄 흔적 없음':'가뭄 흔적 회복';
}

function development(landscape,state){
 const {siteLevel,siteProject,siteDueTurn,nationalLevel}=landscape.infrastructure;
 const level=siteLevel===null?'지역 농경지 단계 미확인':`경작지 ${siteLevel}/3단계`;
 if(siteProject)return `${level} · ${siteProject.level}단계 공사 · ${Math.max(0,siteDueTurn-state.turn)}분기 뒤 완공`;
 return `${level}${nationalLevel>0?` · 국가 생산 시설 ${nationalLevel}단계`:''}`;
}

export function renderFarmLandscape(state,countryId){
 const landscape=farmLandscape(state,countryId);if(!landscape)return '';
 const {phase,climateTurn,climateEvent,climateImpact,lastDroughtTurn,recoveryElapsed}=landscape;
 const asOf=climateTurn===null?'아직 완료한 기후 기록 없음':`${date(climateTurn)} 완료 기준 · ${climateEvent}`;
 const progress=phase==='drought'?`${date(lastDroughtTurn)}의 건조한 농지를 표시합니다.`:phase==='recovering'?`마지막 가뭄 뒤 ${recoveryElapsed}분기 · 새 경작 흔적이 돌아오고 있습니다.`:lastDroughtTurn!==null?'최근 가뭄의 흔적이 회복됐습니다.':'완료된 가뭄 기록이 없습니다.';
 return `<section class="farm-landscape-intel" data-farm-landscape="${phase}" aria-label="농경지 작황"><div class="farm-landscape-heading"><span>땅의 상태</span><strong>${farmStatusLabel(landscape)}</strong></div><p>${escape(asOf)}</p><div class="farm-landscape-facts"><span>${escape(development(landscape,state))}</span>${climateImpact===null?'':`<span>직전 분기 기후·수확 <strong>${signed(climateImpact)}</strong></span>`}</div><details><summary>작황과 비축 구분</summary><p>${escape(progress)} 비축 식량과 땅의 상태는 다릅니다. 수출·소비로 식량이 줄어도 농지가 마르지는 않습니다.</p><p>공사 구역은 완공 뒤 경작지로 바뀝니다. 농지 풍경의 회복은 별도 식량 보상이 아니며, 생산과 기후 효과는 실제 분기 계산을 따릅니다.</p></details></section>`;
}

export function renderFarmResult(state){
 const landscape=farmLandscape(state,state.playerId);if(!landscape||landscape.climateTurn===null)return '';
 const last=state.history?.at(-1),changed=(last?.siteDevelopment?.started??[]).some(item=>item.siteKind==='farm')||(last?.siteDevelopment?.completed??[]).some(item=>item.siteKind==='farm');
 if(!changed&&landscape.phase==='healthy'&&landscape.recoveryElapsed!==4)return '';
 const detail=changed?development(landscape,state):landscape.phase==='recovering'?`마지막 가뭄 뒤 ${landscape.recoveryElapsed}분기`:landscape.climateEvent;
 return `<div class="farm-landscape-result" data-farm-result="${landscape.phase}"><div><span>농경지 · ${farmStatusLabel(landscape)}</span><small>${escape(detail)}</small></div><button type="button" class="text-button" data-action="open-facility" data-country="${state.playerId}" data-site="farm">농지 확인 ↗</button></div>`;
}

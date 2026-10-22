import {nationalProjects} from './project-state.mjs?v=29';
import {COUNTRY_IDS,COUNTRIES,PROFILES} from './engine.mjs?v=29';
import {activeTreaties,getReliability} from './treaties.mjs?v=29';
import {escape} from './render.mjs?v=29';

export function commandTarget(state,requested){
 return COUNTRY_IDS.includes(requested)&&requested!==state.playerId?requested:COUNTRY_IDS.find(id=>id!==state.playerId);
}

export function renderOperatingHorizon(state,phase='decision'){
 const profile=PROFILES[state.playerId];
 const project=nationalProjects(state)[0];
 const development=phase==='result'?state.history.at(-1)?.development:null;
 const milestone=development?.completed?.length?'completed':development?.started?.length?'started':null;
 const facility=project?`${state.farmLevel}/3단계 · ${Math.max(0,project.dueTurn-state.turn)}분기 뒤 완공`:state.farmLevel?`${state.farmLevel}/3단계 운영`:'투자 전 · 0/3단계';
 const treaties=activeTreaties(state).filter(item=>item.playerId===state.playerId||item.targetId===state.playerId);
 const joint=(state.jointInvestments??[]).filter(item=>['building','active','suspended'].includes(item.status));
 const treaty=treaties.toSorted((a,b)=>a.endTurn-b.endTurn)[0];
 const partner=treaty?commandTarget(state,treaty.playerId===state.playerId?treaty.targetId:treaty.playerId):null;
 const kind=treaty?.kind==='alliance'?'지원 동맹':treaty?.kind==='trade_buy'?'수입 협정':'수출 협정';
 const agreement=(treaty?`${COUNTRIES[partner].name} ${kind} · 이행 ${treaty.fulfilled??0}/${treaty.duration}회`:joint.length?'':'장기 협정 없음')+(joint.length?`${treaty?' · ':''}공동 투자 ${joint.length}곳${joint.some(item=>item.status==='suspended')?' · 공급 중단 있음':''}`:'');
 const reliability=treaty?`약속 신뢰 · 우리 ${getReliability(state,state.playerId)} · 상대 ${getReliability(state,partner)}`:'지도에서 상대국을 골라 협상';
 const target=joint[0];
 const jointLinks=joint.map(item=>`<button class="text-button" data-action="open-facility" data-country="${item.targetId}" data-site="${item.kind}">${escape(COUNTRIES[item.targetId].name)} ${item.kind==='farm'?'농경지':'항만'} ↗</button>`).join('');
 return `<div class="operating-line"${milestone?` data-milestone="${milestone}"`:''}><span>국가 사업</span><strong>${escape(profile.facilityName)} · ${escape(facility)}</strong><button class="text-button" data-action="show-view" data-view="records">${milestone==='completed'?'완공 기록 ↗':milestone==='started'?'착공 기록 ↗':'투자 기록 ↗'}</button></div><div class="operating-line"><span>약속</span><div><strong>${escape(agreement)}</strong><small>${target?jointLinks:escape(reliability)}</small></div><button class="text-button" data-action="show-view" data-view="diplomacy">${treaties.length>1?`전체 ${treaties.length}건 ↗`:'외교 ↗'}</button></div>`;
}

import {renderTreatyHistory} from './treaty-ui.mjs?v=30';
import {renderNegotiationHistory} from './negotiation-ui.mjs?v=30';
import {COUNTRIES,getAction} from './engine.mjs?v=30';
import {escape} from './render.mjs?v=30';
const countryName=id=>COUNTRIES[id]?.name??'국제사회';
export const pendingRequests=state=>state.requests.filter(request=>request.status==='pending'&&request.expiresTurn>state.turn);
const typeLabel={aid:'긴급 지원 요청',trade:'교역 협상',technology:'기술 협력'};
export function renderInbox(state,flow,selectedId){
 const requests=pendingRequests(state);
 return `<div class="inbox-header"><div><span class="eyebrow">THE WORLD REACHES OUT</span><h2>먼저 도착한 외교 전문 <span>${requests.length}</span></h2></div><p>제안을 열어도 시간이 흐르지 않습니다.</p></div>${requests.length?`<div class="dispatch-grid">${requests.map(request=>{
  const action=getAction(state,`accept:${request.id}`);
  return `<article class="dispatch-card ${request.id===selectedId?'selected':''}"><div class="dispatch-meta"><span>${countryName(request.fromId)} · ${escape(typeLabel[request.type]??'외교 제안')}</span><strong>${request.expiresTurn-state.turn}분기 내 회신</strong></div><h3>${escape(request.title)}</h3><p>${escape(request.description)}</p><div class="dispatch-terms">${escape(action?.forecast??'조건을 검토한 뒤 회신하세요.')}</div><button class="secondary-button" data-action="open-request" data-request-id="${escape(request.id)}" ${flow.phase!=='decision'?'disabled':''}>${flow.phase==='decision'?'조건과 회신 검토 →':'결과 확인 후 회신 가능'}</button></article>`;
 }).join('')}</div>`:'<div class="inbox-empty">현재 회신할 전문이 없습니다. 타국은 식량·국고·교역 상황에 따라 새로운 요청을 보냅니다.</div>'}`;
}
export function renderWorldActions(state){
 const actions=state.history.at(-1)?.worldActions??[];
 return `<p class="result-story">내 정책에 따른 거래, 기존 공급 계약, 협정과 다른 나라의 자율 행동을 함께 보여줍니다. 거래와 지원은 실제 재고·국고에 반영됩니다.</p><div class="world-action-feed">${actions.map(action=>`<article class="world-action-item"><div><strong>${escape(countryName(action.countryId))}</strong>${action.targetId&&action.targetId!==action.countryId?`<span> → ${escape(countryName(action.targetId))}</span>`:''}<small>${escape(action.source==='foreign_treaty'?'타국 간 협정 이행':action.source==='foreign_network'?'세계 협정망 변화':action.source==='treaty'?'협정·동맹의 약속':action.source==='negotiation'?'내 협상 결과':action.source==='agreement'?'협정 이행':action.source==='policy'?'내 정책에 따른 거래':action.source==='structural'?'기존 공급 계약':{trade:'자율 교역',aid:'국제 지원',investment:'자체 투자',austerity:'재정 조정',request:'먼저 보낸 제안',agreement:'협정 실행',expiry:'기한 종료'}[action.type]??'국가 행동')}</small></div><p>${escape(action.text)}</p></article>`).join('')}</div>`;
}
export function renderDiplomacy(state){
 const agreements=state.agreements.filter(agreement=>agreement.endTurn>state.turn);
 const news=(state.history.at(-1)?.worldActions??[]).filter(action=>['request','agreement','expiry'].includes(action.type));
 const recent=state.requests.filter(request=>request.status!=='pending').slice(-3).toReversed();
 return `${renderTreatyHistory(state)}${renderNegotiationHistory(state)}<div class="diplomacy-counts"><div><b>${pendingRequests(state).length}</b><span>회신 대기</span></div><div><b>${agreements.length}</b><span>진행 중인 협정</span></div></div><h3 class="result-subheading">현재 효력이 있는 협정</h3>${agreements.length?agreements.map(agreement=>`<article class="agreement-card"><strong>${escape(countryName(agreement.fromId))} · ${escape(typeLabel[agreement.type]??'협력 협정')}</strong><p>만료까지 ${agreement.endTurn-state.turn}분기 · 식량 ${agreement.food>0?'+':''}${agreement.food??0} / 국고 ${agreement.treasury>0?'−':''}${agreement.treasury??0} 매 분기</p></article>`).join(''):'<p class="quiet-copy">체결된 협정이 없습니다. 전문을 검토해 교역이나 기술 협력의 조건을 정할 수 있습니다.</p>'}<h3 class="result-subheading">이번 분기의 외교 소식</h3>${news.length?news.map(action=>`<div class="diplomatic-news"><strong>${escape(countryName(action.countryId))}</strong><p>${escape(action.text)}</p></div>`).join(''):'<p class="quiet-copy">이번 분기에는 새 협정이나 기한 종료가 없습니다. 기존 요청과 협정의 시간은 계속 흐릅니다.</p>'}${recent.length?`<h3 class="result-subheading">최근 처리된 전문</h3>${recent.map(request=>`<p class="quiet-copy">${escape(countryName(request.fromId))} · ${escape(request.title)} — ${escape({accept:'수락',counter:'조건 조정',decline:'거절',expired:'회신 기한 종료'}[request.response??request.status]??'처리 완료')}</p>`).join('')}`:''}<p class="decision-note">다음 분기의 선택 화면에서 대기 중인 전문에 회신할 수 있습니다.</p>`;
}

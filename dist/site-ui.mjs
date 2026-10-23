import {COUNTRIES,getAction} from './engine.mjs?v=31';
import {SITE_KINDS,SITE_DEFS,siteView} from './site-operations.mjs?v=31';
import {escape} from './render.mjs?v=31';
import {renderForeignSiteInfo} from './foreign-sites-ui.mjs?v=31';
import {renderJointSection} from './joint-investments-ui.mjs?v=31';
import {renderFarmLandscape} from './farm-landscape-ui.mjs?v=31';

const disabledReason=(state,view,phase,operation,action)=>{
 if(!view.owned)return '외국 시설은 직접 운영할 수 없습니다.';
 if(phase!=='decision')return '결과 확인 중입니다. 다음 분기 현안을 연 뒤 명령을 내리세요.';
 if(!action)return operation==='upgrade'?(view.project?'이 시설은 공사 중입니다.':'최대 3단계입니다.'):'현재 수입 가능한 공급국이 없습니다.';
 if(state.countries[state.playerId].treasury<action.cost)return `국고 ${action.cost-state.countries[state.playerId].treasury}억 부족`;
 if((action.foodCost??0)>state.countries[state.playerId].food)return '필요한 식량이 부족합니다.';
 return '';
};
export function siteOrder(state,selection,phase,operation){
 const view=selection&&siteView(state,selection.countryId,selection.kind);
 if(!view||!['upgrade','manage'].includes(operation))return null;
 const command=`site:${view.kind}:${operation}`,action=view.owned?getAction(state,command):null;
 return {command,action,reason:disabledReason(state,view,phase,operation,action)};
}
export function renderSiteSelector(state,countryId,selection=null){
 if(!COUNTRIES[countryId])return '';
 return `<div class="site-selector-label"><strong>${escape(COUNTRIES[countryId].name)}</strong><span>시설 선택</span></div><div class="site-selector-buttons" role="group" aria-label="${escape(COUNTRIES[countryId].name)} 시설">${SITE_KINDS.map(kind=>{const view=siteView(state,countryId,kind),active=selection?.countryId===countryId&&selection.kind===kind;return `<button type="button" data-action="open-facility" data-country="${countryId}" data-site="${kind}" aria-pressed="${active}"><span>${escape(view.name)}</span><small>${view.project?'공사 중':view.level!==null?`${view.level}/3단계`:'외국 시설'}</small></button>`;}).join('')}</div>`;
}
function orderRow(state,selection,phase,operation,selected){
 const order=siteOrder(state,selection,phase,operation),def=SITE_DEFS[selection.kind];
 const level=siteView(state,selection.countryId,selection.kind).level;
 const name=operation==='upgrade'?(level>=3?`${def.name} 확장 완료`:`${def.name} ${level+1}단계 확장`):def.manageName;
 return `<label class="site-order${selected===operation?' is-selected':''}${order.reason?' is-unavailable':''}"><input type="radio" name="site-operation" value="${operation}"${selected===operation?' checked':''}${order.reason?' disabled':''}><span><strong>${escape(name)}</strong><small>${order.action?escape(order.action.forecast):escape(order.reason)}</small>${order.reason&&order.action?`<em>${escape(order.reason)}</em>`:''}</span></label>`;
}
function ownSitePanel(state,selection,phase,operation,view){
 const benefit='<div class="site-benefit"><span>단계당 운영 효과</span><strong>'+escape(SITE_DEFS[view.kind].benefit)+'</strong></div>';
 const progress=view.project?'<div class="site-build-progress"><span>착공</span><progress max="2" value="'+Math.max(0,2-view.remaining)+'" aria-label="'+escape(view.name)+' 공사 진행"></progress><span>완공</span><small>완공 뒤부터 새 단계의 운영 효과가 발생합니다.</small></div>':'';
 if(phase!=='decision')return benefit+progress+'<p class="site-access-note">분기 결과를 확인한 뒤 다음 명령을 내릴 수 있습니다.</p><button type="button" class="secondary-button" data-action="close-facility">결과로 돌아가기 →</button>';
 const order=siteOrder(state,selection,phase,operation),available=Boolean(order?.action&&!order.reason);
 const status=available?escape(order.action.name)+' · 국고 −'+order.action.cost+'억 · 1분기 진행':escape(order?.reason||'선택·확대만으로는 시간과 자원이 소모되지 않습니다.');
 const submit=available?escape(order.action.name)+' 실행 · 1분기 진행 →':'실행할 명령을 선택하세요';
 return benefit+progress+'<form id="site-form"><fieldset><legend>시설 명령 · 실행하면 1분기 진행</legend>'+orderRow(state,selection,phase,'upgrade',operation)+orderRow(state,selection,phase,'manage',operation)+'</fieldset><p id="site-order-status" class="site-order-status" role="status" aria-atomic="true">'+status+'</p><button type="submit" id="site-execute" class="primary-button"'+(available?'':' disabled')+'>'+submit+'</button></form>';
}
export function renderSitePanel(state,selection,phase,operation=null,jointDraft=null){
 const view=selection&&siteView(state,selection.countryId,selection.kind);
 if(!view)return '';
 const country=COUNTRIES[view.countryId];
 const status=view.level!==null?view.project?'공사 중 · '+view.remaining+'분기 뒤 '+view.project.level+'단계 완공':view.level+'/3단계 운영':'국가 시설 기반 '+view.aggregateInfrastructure+'단계';
 const foreign=renderJointSection(state,view,phase,jointDraft)+(!jointDraft?renderForeignSiteInfo(state,view)+(phase==='decision'?'<button type="button" class="secondary-button" data-action="open-proposal" data-country="'+view.countryId+'">'+escape(country.name)+'와 무역 협상 →</button>':''):'');
 const panel=(view.kind==='farm'?renderFarmLandscape(state,view.countryId):'')+(view.owned?ownSitePanel(state,selection,phase,operation,view):foreign);
 return '<section class="site-console" data-site-panel="'+view.kind+'" data-site-country="'+view.countryId+'" aria-labelledby="decision-title"><div class="dispatch-heading"><span class="console-step">시설 관리</span><button type="button" class="text-button" data-action="close-facility">'+(phase==='result'?'결과로 돌아가기':'국정 명령으로')+' ↗</button></div><h2 id="decision-title" tabindex="-1">'+escape(country.name)+' · '+escape(view.name)+'</h2><div class="site-status"><strong>'+escape(status)+'</strong><button type="button" class="text-button" data-action="site-show-map">지도에서 보기 ↖</button></div>'+panel+'</section>';
}
export function renderSiteResults(state){
 const record=state.history?.at(-1),development=record?.siteDevelopment;
 if(!development)return '';
 const entries=[...(development.completed??[]).map(project=>({project,status:'완공',kind:'completed'})),...(development.started??[]).map(project=>({project,status:'착공',kind:'started'})),...(development.ongoing??[]).filter(project=>!(development.started??[]).some(item=>item.siteKind===project.siteKind)).map(project=>({project,status:`공사 중 · ${Math.max(0,project.dueTurn-state.turn)}분기 남음`,kind:'building'}))];
 const operations=(record.siteOperations??[]).filter(item=>['manage','passive'].includes(item.operation)&&item.text);
 if(!entries.length&&!operations.length)return '';
 return `<section class="site-result-ledger" aria-label="지도 시설 성과">${entries.map(({project,status,kind})=>`<div data-site-result="${kind}" data-site="${project.siteKind}"><span>${escape(SITE_DEFS[project.siteKind].name)}</span><strong>${project.level}단계 ${escape(status)}</strong><small>${kind==='completed'?escape(SITE_DEFS[project.siteKind].benefit):'완공 뒤부터 운영 효과 발생'}</small><button type="button" class="text-button" data-action="open-facility" data-country="${state.playerId}" data-site="${project.siteKind}">지도 시설 확인 ↗</button></div>`).join('')}${operations.length?`<details><summary>이번 분기 시설 운영 내역 ${operations.length}건</summary><ul>${operations.map(item=>`<li>${escape(item.text)}</li>`).join('')}</ul></details>`:''}</section>`;
}

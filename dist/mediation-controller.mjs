import {mediationCommand} from './mediation.mjs?v=29';
import {peaceCounterCommand,peaceOfferAction,peaceOfferPreview,peaceReplyCommand} from './peace-offers.mjs?v=29';
import {peaceComplianceCommand,peaceCompliancePreview} from './peace-compliance.mjs?v=29';
import {mediationDraftFromForm,renderMediationComparison,renderMediationForm,renderMediationPreview,renderMediationTerms} from './mediation-ui.mjs?v=29';
import {renderPeaceOfferReview} from './peace-offer-ui.mjs?v=29';
import {renderPeaceAccordReview,renderPeaceSanctionReview} from './peace-compliance-ui.mjs?v=29';

export function createMediationController({state,resolveAction,decisionContent,clearCompeting,rerender,commit,focus}){
 let draft=null,previousDraft=null,offerId=null,accordId=null,sanctionId=null;
 const currentState=()=>state();
 const command=()=>draft?.accordId?peaceComplianceCommand(draft.accordId,'renegotiate',draft):draft?.offerId?peaceCounterCommand(draft):mediationCommand(draft);
 function refresh(){
  const action=resolveAction(command()),player=currentState().countries[currentState().playerId],allowed=Boolean(action&&player.food>=action.foodCost&&player.treasury>=action.cost);
  const offer=draft.offerId?peaceOfferPreview(currentState(),draft.offerId)?.offer:null,comparison=decisionContent().querySelector('#mediation-comparison');
  const accord=draft.accordId?(currentState().peaceAccords??[]).find(item=>item.id===draft.accordId):null;
  if(comparison&&(offer||accord))comparison.outerHTML=renderMediationComparison(offer??accord,draft);
  decisionContent().querySelector('#mediation-terms').innerHTML=renderMediationTerms(currentState(),draft);
  const leversOpen=Boolean(decisionContent().querySelector('.peace-levers')?.open);
  decisionContent().querySelector('#mediation-preview').innerHTML=renderMediationPreview(currentState(),draft,previousDraft);
  if(leversOpen)decisionContent().querySelector('.peace-levers').open=true;
  const submit=decisionContent().querySelector('#send-mediation');submit.disabled=!allowed;
  submit.firstChild.textContent=allowed?(draft.accordId?'수정안을 보내고 한 분기 진행 ':draft.offerId?'변경 조건을 역제안하고 한 분기 진행 ':'이 조건을 제시하고 한 분기 진행 '):(draft.offerId||draft.accordId)&&!action?'한 가지 이상 조건을 변경하세요 ':'조건 또는 보유 자원을 확인하세요 ';
 }
 return {
  clear(){draft=null;previousDraft=null;offerId=null;accordId=null;sanctionId=null;},
  isOpen(){return Boolean(draft||offerId||accordId||sanctionId);},
  render(){return draft?renderMediationForm(currentState(),draft,previousDraft):offerId?renderPeaceOfferReview(currentState(),offerId):sanctionId?renderPeaceSanctionReview(currentState(),sanctionId):renderPeaceAccordReview(currentState(),accordId);},
  open(conflictId){clearCompeting();this.clear();draft={conflictId,goal:'relief',condition:'mutual',food:4,money:6};rerender();focus();},
  openOffer(id){clearCompeting();this.clear();offerId=id;rerender();focus();},
  openAccord(id){clearCompeting();this.clear();accordId=id;rerender();focus();},
  reviewSanction(id){if(!peaceCompliancePreview(currentState(),id,'sanction'))return;clearCompeting();this.clear();sanctionId=id;rerender();focus();},
  renegotiate(id){const accord=(currentState().peaceAccords??[]).find(item=>item.id===id);if(!accord)return;clearCompeting();this.clear();draft={...accord.terms,conflictId:accord.conflictId,accordId:id};rerender();focus();},
  counterOffer(id){const preview=peaceOfferPreview(currentState(),id);if(!preview)return;clearCompeting();this.clear();draft={...preview.offer.terms,offerId:id};rerender();focus();},
  input(event){const form=event.target.closest?.('#mediation-form');if(!draft||!form)return false;const next=mediationDraftFromForm(form);if(['goal','condition','food','money'].some(key=>draft[key]!==next[key]))previousDraft=draft;draft=next;refresh();return true;},
  submit(event){if(event.target.id==='peace-sanction-form'&&sanctionId){const id=peaceComplianceCommand(sanctionId,'sanction');if(resolveAction(id))commit(id);return true;}if(!draft||event.target.id!=='mediation-form')return false;const id=command();if(resolveAction(id))commit(id);return true;},
  accept(recordId){const command=`mediate-accept:${recordId}`;if(resolveAction(command))commit(command);},
  reply(id,response){const command=peaceReplyCommand(id,response);if(peaceOfferAction(currentState(),command)&&resolveAction(command))commit(command);},
  dispatch(action,data){if(action==='open-mediation')this.open(data.id);else if(action==='accept-mediation-counter')this.accept(data.id);else if(action==='review-peace-offer')this.openOffer(data.id);else if(action==='counter-peace-offer')this.counterOffer(data.id);else if(action==='peace-offer-reply')this.reply(data.id,data.response);else if(action==='review-peace-accord')this.openAccord(data.id);else if(action==='review-peace-sanction')this.reviewSanction(data.id);else if(action==='renegotiate-peace-accord')this.renegotiate(data.id);else return false;return true;},
 };
}

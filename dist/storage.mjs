import {createGame,advanceTurn,getAction,COUNTRY_IDS} from './engine.mjs?v=29';
const KEY='one-planet-food-crisis-v4';
const fresh=(status,id='lumen')=>({state:createGame(id),flow:{phase:'decision',step:0},requestId:null,status});
const validId=id=>COUNTRY_IDS.includes(id);
function replay(actions,id,networkStartTurn,policyStartTurn,objectiveStartTurn,worldGoalStartTurn,conflictStartTurn,mediationStartTurn,peaceOfferStartTurn,peaceComplianceStartTurn,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn){
 if(!Array.isArray(actions)||actions.some(action=>typeof action!=='string'||!action.length||action.length>160))return null;
 let state=createGame(id,{networkStartTurn,policyStartTurn,objectiveStartTurn,worldGoalStartTurn,conflictStartTurn,mediationStartTurn,peaceOfferStartTurn,peaceComplianceStartTurn,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn});
 for(const action of actions){if(!getAction(state,action))return null;state=advanceTurn(state,action);}
 return state;
}
function decode(saved,id,legacy=false){
 if(!saved||typeof saved!=='object'||!Array.isArray(saved.actions)||saved.playerId&&saved.playerId!==id)return fresh('invalid',id);
 const networkStartTurn=saved.networkStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(networkStartTurn)||networkStartTurn<1||networkStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const policyStartTurn=saved.policyStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(policyStartTurn)||policyStartTurn<1||policyStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const objectiveStartTurn=saved.objectiveStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(objectiveStartTurn)||objectiveStartTurn<1||objectiveStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const worldGoalStartTurn=saved.worldGoalStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(worldGoalStartTurn)||worldGoalStartTurn<1||worldGoalStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const conflictStartTurn=saved.conflictStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(conflictStartTurn)||conflictStartTurn<1||conflictStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const mediationStartTurn=saved.mediationStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(mediationStartTurn)||mediationStartTurn<1||mediationStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const peaceOfferStartTurn=saved.peaceOfferStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(peaceOfferStartTurn)||peaceOfferStartTurn<1||peaceOfferStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const peaceComplianceStartTurn=saved.peaceComplianceStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(peaceComplianceStartTurn)||peaceComplianceStartTurn<1||peaceComplianceStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const peaceResponseStartTurn=saved.peaceResponseStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(peaceResponseStartTurn)||peaceResponseStartTurn<1||peaceResponseStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const foreignSiteStartTurn=saved.foreignSiteStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(foreignSiteStartTurn)||foreignSiteStartTurn<1||foreignSiteStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const jointStartTurn=saved.jointStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(jointStartTurn)||jointStartTurn<1||jointStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const foreignStrategyStartTurn=saved.foreignStrategyStartTurn??saved.actions.length+1;
 if(!Number.isSafeInteger(foreignStrategyStartTurn)||foreignStrategyStartTurn<1||foreignStrategyStartTurn>saved.actions.length+1)return fresh('invalid',id);
 const state=replay(saved.actions,id,networkStartTurn,policyStartTurn,objectiveStartTurn,worldGoalStartTurn,conflictStartTurn,mediationStartTurn,peaceOfferStartTurn,peaceComplianceStartTurn,peaceResponseStartTurn,foreignSiteStartTurn,jointStartTurn,foreignStrategyStartTurn);
 if(!state)return fresh('invalid',id);
 const phase=legacy&&saved.phase==='ending'?'decision':saved.phase;
 if(!['decision','result'].includes(phase)||!Number.isInteger(saved.step)||saved.step<0||saved.step>3||phase==='result'&&!state.turn)return fresh('invalid',id);
 const flow={phase,step:phase==='decision'?0:saved.step};
 const requestId=typeof saved.requestId==='string'&&state.requests.some(r=>r.id===saved.requestId&&r.status==='pending'&&r.expiresTurn>state.turn)?saved.requestId:null;
 return {state,flow,requestId,status:legacy?'migrated':'restored'};
}
function legacySlot(){
 for(const key of ['one-planet-food-crisis-v3','one-planet-food-crisis-v2','one-planet-food-crisis-v1']){
  const raw=localStorage.getItem(key);if(!raw)continue;
  const value=JSON.parse(raw);
  return key.endsWith('v1')?{actions:value,phase:'decision',step:0,playerId:'lumen'}:{...value,legacy:true,phase:value.phase==='ending'?'decision':value.phase,playerId:'lumen'};
 }
 return null;
}
function readRoot(){
 const raw=localStorage.getItem(KEY);if(!raw)return null;
 const root=JSON.parse(raw);
 if(root?.version!==4||!validId(root.activePlayerId)||!root.games||typeof root.games!=='object'||Array.isArray(root.games))throw new SyntaxError('저장 형식 오류');
 return root;
}
export function loadGame(playerId=null){
 if(playerId!==null&&!validId(playerId))return fresh('invalid');
 try{
  const root=readRoot(),id=playerId??root?.activePlayerId??'lumen';
  if(root?.games[id])return decode(root.games[id],id,Boolean(root.games[id].legacy));
  if(id==='lumen'){const legacy=legacySlot();if(legacy)return decode(legacy,id,true);}
  return fresh('new',id);
 }catch(error){return fresh(error instanceof SyntaxError?'invalid':'unavailable',playerId??'lumen');}
}
export function savedCountries(){
 try{const root=readRoot(),slots={...root?.games};if(!slots.lumen){const legacy=legacySlot();if(legacy)slots.lumen=legacy;}return Object.fromEntries(COUNTRY_IDS.filter(id=>Array.isArray(slots[id]?.actions)).map(id=>[id,slots[id].actions.length]));}
 catch{return {};}
}
export function saveGame(state,flow={phase:'decision',step:0},requestId=null){
 try{
  let root;try{root=readRoot();}catch{root=null;}
  const games={...root?.games};
  if(!games.lumen){try{const legacy=legacySlot();if(legacy)games.lumen=legacy;}catch{}}
 games[state.playerId??'lumen']={playerId:state.playerId??'lumen',actions:state.commands,networkStartTurn:state.networkStartTurn??state.turn+1,policyStartTurn:state.policyStartTurn??state.turn+1,objectiveStartTurn:state.objectiveStartTurn??state.turn+1,worldGoalStartTurn:state.worldGoalStartTurn??state.turn+1,conflictStartTurn:state.conflictStartTurn??state.turn+1,mediationStartTurn:state.mediationStartTurn??state.turn+1,peaceOfferStartTurn:state.peaceOfferStartTurn??state.turn+1,peaceComplianceStartTurn:state.peaceComplianceStartTurn??state.turn+1,peaceResponseStartTurn:state.peaceResponseStartTurn??state.turn+1,foreignSiteStartTurn:state.foreignSiteStartTurn??state.turn+1,jointStartTurn:state.jointStartTurn??state.turn+1,foreignStrategyStartTurn:state.foreignStrategyStartTurn??state.turn+1,phase:flow.phase,step:flow.step,requestId};
  localStorage.setItem(KEY,JSON.stringify({version:4,activePlayerId:state.playerId??'lumen',games}));return true;
 }catch{return false;}
}

import test from 'node:test';
import assert from 'node:assert/strict';

import {COUNTRY_IDS,advanceTurn,createGame,getAction} from '../dist/engine.mjs';
import {quarterPriority} from '../dist/quarter-priority.mjs';
import {mapAttention} from '../dist/map-attention.mjs';

const quiet={networkStartTurn:999,policyStartTurn:999,objectiveStartTurn:999,worldGoalStartTurn:999,conflictStartTurn:999,mediationStartTurn:999,peaceOfferStartTurn:999,peaceComplianceStartTurn:999,peaceResponseStartTurn:999,foreignSiteStartTurn:999,jointStartTurn:999,foreignStrategyStartTurn:999};

test('policy comparison appears separately from total food and names its comparison basis',()=>{
 const state=advanceTurn(createGame('lumen'),'embargo'),last=state.history.at(-1);
 const model=mapAttention(state,'result');
 assert.equal(model.pins[1].label,'명령 차이 · 식량');
 assert.equal(model.pins[1].value,`유지 대비 +${last.policyEffect.food}`);
 assert.equal(model.pins[1].action,'focus-order');
 assert.equal(model.metrics[0].delta,state.countries.lumen.food-last.beforeCountries.lumen.food);
 assert.notEqual(model.metrics[0].delta,last.policyEffect.food);
});

test('national investment remains visible even when higher ranked foreign trade crowds the old list',()=>{
 const state=advanceTurn(createGame('lumen'),'invest');
 state.history.at(-1).jointInvestmentEvents=Array.from({length:3},(_,index)=>({source:'joint_investment',operation:'settlement',countryId:['nord','cera','marin'][index],kind:'farm',food:2,money:0}));
 const model=mapAttention(state,'result');
 assert.equal(model.pins[1].value,'착공');assert.match(model.pins[1].label,/관개/);
 assert.equal(model.pins[1].countryId,'lumen');assert.equal(model.pins[1].siteKind,null);
});

test('an expired restriction does not appear as a fresh supply interruption',()=>{
 const state=advanceTurn(createGame('lumen',quiet),'maintain');
 state.history.at(-1).worldActions=[{source:'peace_response',type:'peace_response_expired',countryId:'nord',targetId:'lumen',text:'제재 기간 종료'}];
 const pin=mapAttention(state,'result').pins[1];
 assert.equal(pin.value,'변경');assert.equal(pin.tone,'neutral');
});

test('all six countries receive one immutable canonical decision pin',()=>{
 for(const playerId of COUNTRY_IDS){
  // Given
  const state=createGame(playerId),before=structuredClone(state);

  // When
  const model=mapAttention(state);

  // Then
  assert.equal(model.mode,'decision',playerId);
  assert.equal(model.pins.length,1,playerId);
  assert.equal(model.pins[0].countryId,playerId,playerId);
  assert.equal(model.pins[0].siteKind,null,playerId);
  assert.equal(model.pins[0].label,getAction(state,quarterPriority(state).commandId)?.name??'이번 과제',playerId);
  assert.equal(model.pins[0].value,'명령 검토 →',playerId);
  assert.equal(model.pins[0].action,'inspect-priority',playerId);
  assert.deepEqual(model.metrics,[],playerId);
  assert.deepEqual(state,before,playerId);
 }
});

test('resource thresholds show the real player total without inventing a facility target',()=>{
 // Given
 const safe=createGame('lumen');safe.countries.lumen.food=35;
 const hungry=createGame('lumen');hungry.countries.lumen.food=34;
 const expensive=createGame('nord');expensive.countries.nord.price=160;

 // When
 const safeModel=mapAttention(safe),hungryModel=mapAttention(hungry),expensiveModel=mapAttention(expensive);

 // Then
 assert.notEqual(safeModel.pins[0].label,'식량 부족');
 assert.deepEqual(hungryModel.pins,[{id:'priority:resource:lumen',countryId:'lumen',siteKind:null,label:'식량 부족',value:'식량 34',tone:'danger',icon:'alert',action:'inspect-priority',changeId:null}]);
 assert.deepEqual(expensiveModel.pins,[{id:'priority:resource:nord',countryId:'nord',siteKind:null,label:'물가 급등',value:'생활물가 160',tone:'danger',icon:'alert',action:'inspect-priority',changeId:null}]);
});

test('deadline and suspended supply pins keep their canonical country and site targets',()=>{
 // Given
 const deadline=createGame('lumen'),request=deadline.requests[0];deadline.turn=request.expiresTurn-1;
 const supply=createGame('lumen');supply.requests=[];supply.jointInvestments=[{id:'joint-lumen-nord-farm-1',targetId:'nord',kind:'farm',status:'suspended',dueTurn:2,endTurn:9,lastReason:'무역 제재'}];

 // When
 const deadlineModel=mapAttention(deadline),supplyModel=mapAttention(supply);

 // Then
 assert.equal(deadlineModel.pins[0].label,'회신 마감');
 assert.equal(deadlineModel.pins[0].countryId,request.fromId);
 assert.equal(deadlineModel.pins[0].siteKind,null);
 assert.equal(supplyModel.pins[0].label,'공급 중단');
 assert.equal(supplyModel.pins[0].countryId,'nord');
 assert.equal(supplyModel.pins[0].siteKind,'farm');
});

test('a real farm upgrade becomes a player food-total pin and an exact construction pin',()=>{
 // Given
 const state=advanceTurn(createGame('lumen',quiet),'site:farm:upgrade'),before=structuredClone(state),last=state.history.at(-1);

 // When
 const model=mapAttention(state,'result');

 // Then
 assert.equal(model.mode,'result');
 assert.equal(model.heading,last.actionLabel);
 assert.equal(model.actionLabel,'결과 자세히');
 assert.deepEqual(model.metrics,[
  {key:'food',label:'식량',before:last.beforeCountries.lumen.food,after:state.countries.lumen.food,delta:state.countries.lumen.food-last.beforeCountries.lumen.food},
  {key:'treasury',label:'국고',before:last.beforeCountries.lumen.treasury,after:state.countries.lumen.treasury,delta:state.countries.lumen.treasury-last.beforeCountries.lumen.treasury},
 ]);
 assert.deepEqual(model.pins[0],{id:`result:food:${last.turn}:lumen`,countryId:'lumen',siteKind:null,label:'분기 식량',value:`${last.beforeCountries.lumen.food} → ${state.countries.lumen.food}`,tone:'danger',icon:'arrow',action:'focus-order',changeId:null});
 assert.deepEqual(model.pins[1],{id:`result:site-started:${last.turn}:lumen:farm`,countryId:'lumen',siteKind:'farm',label:'지역 농경지',value:'착공',tone:'notice',icon:'build',action:'focus-map-change',changeId:`${last.turn}:site-started:lumen:farm:0`});
 assert.deepEqual(state,before);
});

test('a real farm completion is positive and belongs to the completed last record',()=>{
 // Given
 let state=advanceTurn(createGame('lumen',quiet),'site:farm:upgrade');
 state=advanceTurn(state,'maintain');
 state=advanceTurn(state,'maintain');
 const before=structuredClone(state),last=state.history.at(-1);

 // When
 const model=mapAttention(state,'result');

 // Then
 assert.deepEqual(model.pins[1],{id:`result:site-completed:${last.turn}:lumen:farm`,countryId:'lumen',siteKind:'farm',label:'지역 농경지',value:'완공',tone:'positive',icon:'check',action:'focus-map-change',changeId:`${last.turn}:site-completed:lumen:farm:0`});
 assert.deepEqual(state,before);
});

test('result food reports the actual quarter total rather than the policy counterfactual effect',()=>{
 // Given
 const state=advanceTurn(createGame('lumen',quiet),'subsidy'),last=state.history.at(-1);
 assert.notEqual(state.countries.lumen.food-last.beforeCountries.lumen.food,last.policyEffect.food);

 // When
 const model=mapAttention(state,'result');

 // Then
 assert.equal(model.metrics[0].delta,state.countries.lumen.food-last.beforeCountries.lumen.food);
 assert.equal(model.pins[0].value,`${last.beforeCountries.lumen.food} → ${state.countries.lumen.food}`);
 assert.notEqual(model.metrics[0].delta,last.policyEffect.food);
});

test('only the last record can supply a result event',()=>{
 // Given
 let state=advanceTurn(createGame('lumen',quiet),'site:farm:upgrade');
 state=advanceTurn(state,'maintain');
 const before=structuredClone(state);

 // When
 const model=mapAttention(state,'result');

 // Then
 assert.equal(model.heading,state.history.at(-1).actionLabel);
 assert.equal(model.pins.length,1);
 assert.deepEqual(state,before);
});

test('player construction survives ranked foreign changes and the projection remains capped at two pins',()=>{
 // Given
 const state=advanceTurn(createGame('lumen',quiet),'site:farm:upgrade'),last=state.history.at(-1);
 last.jointInvestmentEvents=[
  {source:'joint_investment',operation:'settlement',countryId:'nord',kind:'farm',food:4,money:0},
  {source:'joint_investment',operation:'settlement',countryId:'cera',kind:'farm',food:3,money:0},
  {source:'joint_investment',operation:'settlement',countryId:'marin',kind:'port',food:0,money:5},
 ];
 const before=structuredClone(state);

 // When
 const model=mapAttention(state,'result');

 // Then
 assert.equal(model.pins.length,2);
 assert.equal(model.pins[1].siteKind,'farm');
 assert.equal(model.pins[1].value,'착공');
 assert.equal(model.pins[1].action,'focus-order');
 assert.equal(model.pins[1].changeId,null);
 assert.deepEqual(state,before);
});

test('result mode returns no display model without a canonical before snapshot',()=>{
 // Given
 const opening=createGame('lumen',quiet),incomplete=createGame('lumen',quiet);
 incomplete.history=[{turn:1,playerId:'lumen',actionLabel:'불완전 기록'}];

 // When
 const openingModel=mapAttention(opening,'result'),incompleteModel=mapAttention(incomplete,'result');

 // Then
 assert.equal(openingModel,null);
 assert.equal(incompleteModel,null);
});

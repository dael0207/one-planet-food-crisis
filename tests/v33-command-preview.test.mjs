import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';

import {COUNTRY_IDS,advanceTurn,createGame,getAction,jointCommand,pendingPeaceOffers,peaceReplyCommand} from '../dist/engine.mjs';
import {commandPreview} from '../dist/command-preview.mjs';
import {proposalCommand} from '../dist/negotiations.mjs';
import {treatyCommand} from '../dist/treaties.mjs';

const quiet={networkStartTurn:999,policyStartTurn:1,objectiveStartTurn:999,worldGoalStartTurn:999,conflictStartTurn:999,mediationStartTurn:999,peaceOfferStartTurn:999,peaceComplianceStartTurn:999,peaceResponseStartTurn:999,foreignSiteStartTurn:999,jointStartTurn:999,foreignStrategyStartTurn:999};
const run=(state,count,command='maintain')=>{for(let turn=0;turn<count;turn++)state=advanceTurn(state,command);return state;};
const offered=()=>run(createGame('lumen',{foreignSiteStartTurn:999}),4);

test('zero-effect foreign outcomes retain the addressed nation and authoritative response',()=>{
 const state=createGame('lumen'),command=treatyCommand({targetId:'cera',kind:'trade_buy',food:8,money:1,duration:12});
 assert.equal(getAction(state,command).treatyPreview.response,'reject');
 const treaty=commandPreview(state,command);
 assert.equal(treaty.pins[0].countryId,'cera');assert.match(treaty.pins[0].value,/거절 예상/);
 const counter=advanceTurn(createGame('lumen',quiet),'propose:cera:buy:3:3'),record=counter.negotiations.at(-1);
 assert.equal(record.status,'countered');counter.relations['cera:lumen']=0;
 const reply=commandPreview(counter,`reply:${record.id}:decline`);
 assert.equal(reply.pins[0].countryId,'cera');assert.match(reply.pins[0].value,/거절 예정/);
});

test('all six countries receive exact immutable quarter forecasts from the canonical engine',()=>{
 for(const playerId of COUNTRY_IDS){
  // Given
  const state=createGame(playerId,quiet),before=structuredClone(state);
  const expected=advanceTurn(structuredClone(state),'maintain');

  // When
  const first=commandPreview(state,'maintain'),second=commandPreview(state,'maintain');

  // Then
  assert.deepEqual(first,second,playerId);
  assert.equal(first.mode,'preview',playerId);
  assert.equal(first.heading,getAction(state,'maintain').name,playerId);
  assert.equal(first.actionLabel,'선택한 명령',playerId);
  assert.equal(first.notice,'현재 조건 모의계산 · 실행 전',playerId);
  assert.equal(first.commandId,'maintain',playerId);
  for(const metric of first.metrics){
   assert.equal(metric.before,state.countries[playerId][metric.key],`${playerId}:${metric.key}:before`);
   assert.equal(metric.after,expected.countries[playerId][metric.key],`${playerId}:${metric.key}:after`);
   assert.equal(metric.delta,metric.after-metric.before,`${playerId}:${metric.key}:delta`);
   assert.equal(metric.commandEffect,0,`${playerId}:${metric.key}:effect`);
  }
  assert.ok(first.pins.length<=2,playerId);
  assert.deepEqual(state,before,playerId);
 }
});

test('national and regional construction previews show starts and deferred completion without claiming production',()=>{
 // Given
 const national=createGame('lumen',quiet),regional=createGame('marin',quiet);
 const nationalBaseline=advanceTurn(national,'maintain'),nationalNext=advanceTurn(national,'invest');
 const regionalBaseline=advanceTurn(regional,'maintain'),regionalNext=advanceTurn(regional,'site:farm:upgrade');

 // When
 const nationalModel=commandPreview(national,'invest'),regionalModel=commandPreview(regional,'site:farm:upgrade');

 // Then
 assert.deepEqual(nationalModel.pins[0],{id:'preview:project:lumen',countryId:'lumen',siteKind:null,label:'관개 시설',value:'착공 예정 · 2분기 뒤',tone:'preview',icon:'build',action:'focus-order',changeId:null});
 assert.equal(nationalModel.metrics[0].commandEffect,nationalNext.countries.lumen.food-nationalBaseline.countries.lumen.food);
 assert.equal(nationalModel.metrics[0].commandEffect,0);
 assert.deepEqual(regionalModel.pins[0],{id:'preview:site:marin:farm',countryId:'marin',siteKind:'farm',label:'지역 농경지',value:'착공 예정 · 2분기 뒤',tone:'preview',icon:'build',action:'focus-order',changeId:null});
 assert.equal(regionalNext.siteLevels.farm,0);
 assert.equal(regionalModel.metrics[0].commandEffect,regionalNext.countries.marin.food-regionalBaseline.countries.marin.food);
});

test('balanced trade exposes Nord relation change against maintain while aid shows projected resources in both countries',()=>{
 // Given
 const state=createGame('lumen',quiet),baseline=advanceTurn(state,'maintain');
 const balanced=advanceTurn(state,'balanced'),aided=advanceTurn(state,'aid');

 // When
 const balancedModel=commandPreview(state,'balanced'),aidModel=commandPreview(state,'aid');

 // Then
 const relationPin=balancedModel.pins.find(pin=>pin.countryId==='nord');
 assert.equal(relationPin.label,'노르드 관계');
 assert.match(relationPin.value,new RegExp(`관계 ${state.relations['lumen:nord']} → ${balanced.relations['lumen:nord']} 예상`));
 assert.match(relationPin.value,new RegExp(`유지 대비 \\+${balanced.relations['lumen:nord']-baseline.relations['lumen:nord']}`));
 const nordPin=aidModel.pins.find(pin=>pin.countryId==='nord');
 assert.equal(nordPin.label,'노르드');
 assert.equal(nordPin.value,`유지 대비 식량 ${aided.countries.nord.food-baseline.countries.nord.food>0?'+':''}${aided.countries.nord.food-baseline.countries.nord.food} · 국고 ${aided.countries.nord.treasury-baseline.countries.nord.treasury>0?'+':''}${aided.countries.nord.treasury-baseline.countries.nord.treasury} 예상`);
 assert.equal(aidModel.metrics.find(metric=>metric.key==='food').after,aided.countries.lumen.food);
 assert.equal(aidModel.metrics.find(metric=>metric.key==='treasury').after,aided.countries.lumen.treasury);
});

test('accepted and rejected proposals use structured target outcomes while invalid proposals clear the preview',()=>{
 // Given
 const acceptedState=createGame('lumen',quiet);acceptedState.relations['cera:lumen']=100;acceptedState.countries.lumen.food=80;acceptedState.countries.lumen.treasury=80;acceptedState.countries.cera.food=80;acceptedState.countries.cera.treasury=80;
 const acceptedCommand=proposalCommand({targetId:'cera',kind:'buy',food:3,money:6});
 const rejectedState=createGame('lumen',quiet);rejectedState.relations['cera:lumen']=5;
 const rejectedCommand=proposalCommand({targetId:'cera',kind:'buy',food:3,money:6});

 // When
 const accepted=commandPreview(acceptedState,acceptedCommand),rejected=commandPreview(rejectedState,rejectedCommand);

 // Then
 assert.equal(getAction(acceptedState,acceptedCommand).preview.response,'accept');
 assert.equal(accepted.pins.find(pin=>pin.countryId==='cera').label,'세라');
 assert.equal(accepted.pins.find(pin=>pin.countryId==='cera').value,'유지 대비 식량 −3 · 국고 +6 예상');
 assert.equal(getAction(rejectedState,rejectedCommand).preview.response,'reject');
 assert.equal(rejected.pins.find(pin=>pin.countryId==='cera').label,'세라 관계');
 assert.match(rejected.pins.find(pin=>pin.countryId==='cera').value,/예상 · 유지 대비/);
 assert.equal(commandPreview(rejectedState,'propose:lumen:buy:2:2'),null);
 assert.equal(commandPreview(rejectedState,'propose:cera:buy:0:2'),null);
});

test('declining a canonical peace offer keeps the offering nation visible despite zero direct effects',()=>{
 // Given
 const state=offered(),offer=pendingPeaceOffers(state)[0],command=peaceReplyCommand(offer.id,'decline');
 const maintained=advanceTurn(state,'maintain'),declined=advanceTurn(state,command);
 assert.deepEqual(declined.countries,maintained.countries);
 assert.deepEqual(declined.relations,maintained.relations);

 // When
 const model=commandPreview(state,command);

 // Then
 assert.deepEqual(model.pins[0],{id:`preview:response:${offer.fromId}`,countryId:offer.fromId,siteKind:null,label:state.countries[offer.fromId].name,value:'평화 제안 거절 예정 · 직접 변화 없음',tone:'preview',icon:'reply',action:'focus-order',changeId:null});
 assert.ok(model.pins.length<=2);
 assert.deepEqual(model.metrics.map(metric=>metric.commandEffect),[0,0]);
});

test('site management targets the facility and port procurement identifies the actual seller',()=>{
 const state=createGame('marin',quiet),action=getAction(state,'site:port:manage');
 const model=commandPreview(state,action.id);

 assert.equal(model.pins[0].countryId,'marin');
 assert.equal(model.pins[0].siteKind,'port');
 assert.equal(model.pins[0].label,'국제 항만');
 assert.match(model.pins[0].value,/예상/);
 assert.equal(model.pins[1].countryId,action.site.sellerId);
 assert.equal(model.pins[1].label,state.countries[action.site.sellerId].name);
 assert.ok(model.pins.length<=2);
});

test('foreign joint investment previews target the real site for accepted and rejected terms',()=>{
 const options={...quiet,foreignSiteStartTurn:1,jointStartTurn:1};
 const acceptedState=createGame('lumen',options),acceptedCommand=jointCommand({targetId:'nord',kind:'farm',capital:20,share:25,duration:8});
 const rejectedState=createGame('lumen',options),rejectedCommand=jointCommand({targetId:'cera',kind:'port',capital:12,share:75,duration:4});

 const accepted=commandPreview(acceptedState,acceptedCommand),rejected=commandPreview(rejectedState,rejectedCommand);

 assert.deepEqual(accepted.pins[0],{id:'preview:joint:nord:farm',countryId:'nord',siteKind:'farm',label:'지역 농경지',value:'착공 예정 · 2분기 뒤',tone:'preview',icon:'build',action:'focus-order',changeId:null});
 assert.equal(accepted.metrics[0].commandEffect,0);
 assert.deepEqual(rejected.pins[0],{id:'preview:joint:cera:port',countryId:'cera',siteKind:'port',label:'국제 항만',value:'협상 결과 거절 예상 · 투자금 지출 없음',tone:'preview',icon:'reply',action:'focus-order',changeId:null});
 assert.equal(rejected.metrics.find(metric=>metric.key==='treasury').commandEffect,0);
});

test('unavailable or unaffordable commands return null and never replace the current real result',()=>{
 // Given
 const resultState=advanceTurn(createGame('lumen',quiet),'maintain'),before=structuredClone(resultState);
 const poor=createGame('lumen',quiet);poor.countries.lumen.treasury=0;poor.countries.lumen.food=0;

 // When
 const preview=commandPreview(resultState,'aid');

 // Then
 assert.equal(preview.mode,'preview');
 assert.equal(resultState.history.at(-1).policyId,'maintain');
 assert.deepEqual(resultState,before);
 for(const command of [null,'','unknown','invest','aid'])assert.equal(commandPreview(command==='invest'?poor:command==='aid'?poor:resultState,command),null);
});

test('existing time-driven completion is not presented as command-caused and pins stay bounded',()=>{
 const state=createGame('lumen',quiet);state.turn=1;state.projects=[{type:'facility',countryId:'lumen',dueTurn:2}];

 const model=commandPreview(state,'maintain');

 assert.equal(model.pins.some(pin=>pin.icon==='build'),false);
 assert.ok(model.pins.length<=2);
 assert.match(model.pins[0].value,/예상/);
});

test('moderately dense campaigns remain deterministic within an interactive projection budget',()=>{
 let state=createGame('lumen');
 for(let turn=0;turn<14;turn++)state=advanceTurn(state,'maintain');
 const before=structuredClone(state),start=performance.now();

 const models=Array.from({length:20},()=>commandPreview(state,'subsidy'));

 assert.ok(performance.now()-start<1500);
 assert.ok(models.every(model=>model&&model.pins.length<=2));
 assert.ok(models.every(model=>JSON.stringify(model)===JSON.stringify(models[0])));
 assert.deepEqual(state,before);
});

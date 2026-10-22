import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,COUNTRY_IDS} from '../dist/engine.mjs';
import {previewJointInvestment,jointCommand} from '../dist/joint-investments.mjs';
import {renderJointForm,renderJointPreview,renderJointContract,renderJointResults} from '../dist/joint-investments-ui.mjs';
import {renderSitePanel} from '../dist/site-ui.mjs';
import {createSiteController} from '../dist/site-controller.mjs';
import {mapSiteModels} from '../dist/map-sites.mjs';
import {mapRoutes} from '../dist/map-geometry.mjs';

const draft={targetId:'cera',kind:'farm',capital:20,share:50,duration:8};
test('foreign port/farm joint investment is discoverable while direct foreign and result orders remain locked',()=>{
 for(const id of COUNTRY_IDS){
  const state=createGame(id),foreign=COUNTRY_IDS.find(other=>other!==id);
  for(const kind of ['port','farm']){
   const html=renderSitePanel(state,{countryId:foreign,kind},'decision');
   assert.match(html,/data-action="open-joint-investment"/);assert.doesNotMatch(html,/id="site-form"/);
   assert.doesNotMatch(renderSitePanel(state,{countryId:foreign,kind},'result',null,{...draft,targetId:foreign,kind}),/id="joint-form"/);
  }
  assert.doesNotMatch(renderSitePanel(state,{countryId:foreign,kind:'city'},'decision'),/data-action="open-joint-investment"/);
  assert.doesNotMatch(renderSitePanel(state,{countryId:id,kind:'farm'},'decision'),/data-action="open-joint-investment"/);
 }
});

test('condition preview is pure and discloses shared output, one-quarter send cost, cap risk and interruption thresholds',()=>{
 const state=createGame('lumen'),before=structuredClone(state);
 const first=renderJointForm(state,draft),changed=renderJointPreview(state,{...draft,capital:28,share:75,duration:12});
 assert.match(first,/name="capital"/);assert.match(first,/name="share"/);assert.match(first,/name="duration"/);
 assert.match(first,/우리 배분 50% · 현지국 50%/);assert.match(changed,/우리 배분 75% · 현지국 25%/);
 assert.match(changed,/12분기/);assert.match(changed,/관계 35 미만/);assert.match(changed,/관계 45 이상/);
 assert.match(first,/투자 원금은 반환되지 않습니다/);assert.match(first,/role="status" aria-atomic="true"/);
 assert.deepEqual(state,before);
});

test('contract rendering escapes reasons and exposes exact state/cumulative real payouts',()=>{
 const state=createGame();const contract={...draft,id:'joint-test',status:'suspended',dueTurn:3,endTurn:11,totalFood:7,totalRevenue:2,lastReason:'<img src=x onerror=alert(1)>'};
 const html=renderJointContract(state,contract);
 assert.match(html,/공급 중단/);assert.match(html,/누적 식량 7 · 수익 2억/);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);
});

test('mounted joint controller edits terms without advancing and submits only canonical selected foreign command',()=>{
 const previous=globalThis.document,preview={innerHTML:''},submit={disabled:false};
 globalThis.document={getElementById:id=>id==='joint-preview'?preview:submit,querySelectorAll:()=>[]};
 try{
  let state=createGame(),phase='decision';const commits=[];
  const controller=createSiteController({state:()=>state,phase:()=>phase,clearCompeting:()=>controller.clear(),select(){},rerender(){},focus(){},commit:command=>{commits.push(command);state=advanceTurn(state,command);phase='result';}});
  controller.dispatch('open-facility',{country:'cera',site:'farm'});
  controller.dispatch('open-joint-investment',{country:'cera',site:'farm'});
  const before=structuredClone(state);
  for(const [name,value] of [['capital','28'],['share','25'],['duration','4']])controller.input({target:{name,value,closest:selector=>selector==='#joint-form'?{id:'joint-form'}:null}});
  assert.deepEqual(state,before);assert.match(preview.innerHTML,/우리 배분 25%/);
  controller.submit({target:{id:'joint-form'}});assert.deepEqual(commits,[jointCommand({...draft,capital:28,share:25,duration:4})]);
  controller.submit({target:{id:'joint-form'}});assert.equal(commits.length,1);
  controller.dispatch('open-facility',{country:'lumen',site:'port'});controller.dispatch('open-joint-investment',{country:'lumen',site:'port'});controller.submit({target:{id:'joint-form'}});assert.equal(commits.length,1);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('real accepted investment is visible on the map model and result accounting matches actual event impacts',()=>{
 const state=createGame();const accepted={...draft,capital:28,share:25,duration:4};
 assert.equal(previewJointInvestment(state,accepted).outcome,'accepted');
 const next=advanceTurn(state,jointCommand(accepted));
 const model=mapSiteModels(next).find(item=>item.countryId==='cera'&&item.kind==='farm');
 assert.equal(model.joint.status,'building');assert.ok(model.view.project);
 const events=next.history.at(-1).jointInvestmentEvents;
 const net=events.reduce((sum,item)=>sum+(item.playerImpact?.treasury??0),0);
 assert.match(renderJointResults(next),new RegExp(`국고 ${net>=0?'\\+':''}${net}억`));
 assert.match(renderJointResults(next),/data-action="open-facility"/);
});

test('joint map arrows show actual food shipments and exclude capital acceptance, port revenue, and suspended supply',()=>{
 const accepted={...draft,capital:28,share:25,duration:12};
 let farm=advanceTurn(createGame(),jointCommand(accepted));
 assert.equal(mapRoutes(farm).filter(item=>item.source==='joint_investment').length,0);
 let shipment=null;
 for(let turn=0;turn<10&&!shipment;turn++){
  farm=advanceTurn(farm,'maintain');
  shipment=farm.history.at(-1).jointInvestmentEvents.find(item=>item.food>0&&item.shipmentFromId);
 }
 assert.ok(shipment);
 const routes=mapRoutes(farm).filter(item=>item.source==='joint_investment');
 assert.equal(routes.length,1);assert.equal(routes[0].countryId,shipment.shipmentFromId);assert.equal(routes[0].targetId,farm.playerId);
 const noFood={...farm,history:[{worldActions:[{source:'joint_investment',type:'investment',countryId:'cera',targetId:'lumen',food:0},{source:'joint_investment',type:'trade',countryId:'cera',targetId:'lumen',food:0,money:2},{source:'joint_investment',type:'operation',operation:'suspended',countryId:'cera',targetId:'lumen'}]}]};
 assert.equal(mapRoutes(noFood).filter(item=>item.source==='joint_investment').length,0);
});

test('hard finance rejection explains the limit even when the willingness score exceeds the threshold',()=>{
 const state=createGame();state.countries.cera.treasury=95;state.relations['cera:lumen']=100;
 const terms={...draft,capital:28,share:25,duration:12},preview=previewJointInvestment(state,terms);
 assert.equal(preview.outcome,'rejected');assert.ok(preview.score>=preview.threshold);
 const html=renderJointPreview(state,terms);assert.match(html,/거절 예상 · 현지 공동 부담 뒤/);assert.doesNotMatch(html,/점 여유/);
});

test('contract horizon counts future distribution quarters after the latest completed quarter',()=>{
 const state=createGame();state.turn=3;
 const html=renderJointContract(state,{...draft,id:'joint-test',status:'active',dueTurn:3,endTurn:7,totalFood:0,totalRevenue:0});
 assert.match(html,/앞으로 3분기 배분 가능/);
});

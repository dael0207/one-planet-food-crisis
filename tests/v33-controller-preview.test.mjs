import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,getAction} from '../dist/engine.mjs';
import {jointCommand} from '../dist/joint-investments.mjs';
import {createMediationController} from '../dist/mediation-controller.mjs';
import {createSiteController} from '../dist/site-controller.mjs';

const siteRadio=value=>({target:{value,closest:selector=>selector==='#site-form'?{id:'site-form'}:null}});

test('site preview lookup and live operation input expose only an executable command without advancing state',()=>{
 const previous=globalThis.document,execute={disabled:true,textContent:''},status={hidden:true,textContent:''};
 globalThis.document={getElementById:id=>id==='site-execute'?execute:status,querySelectorAll:()=>[]};
 try{
  const state=createGame('lumen'),before=structuredClone(state),commits=[],previews=[];
  const controller=createSiteController({state:()=>state,phase:()=> 'decision',clearCompeting:()=>controller.clear(),select(){},rerender(){},focus(){},commit:id=>commits.push(id),preview:id=>previews.push(id)});
  assert.equal(controller.previewCommand(),null);
  controller.dispatch('open-facility',{country:'lumen',site:'farm'});
  assert.equal(controller.previewCommand(),null);
  controller.input(siteRadio('upgrade'));
  assert.equal(controller.previewCommand(),'site:farm:upgrade');
  assert.deepEqual(previews,['site:farm:upgrade']);
  assert.deepEqual(commits,[]);assert.deepEqual(state,before);
  controller.clear();assert.equal(controller.previewCommand(),null);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('site preview rejects foreign, unaffordable and cleared orders while joint input exposes the canonical draft only when valid',()=>{
 const previous=globalThis.document,previewNode={innerHTML:''},submit={disabled:false};
 globalThis.document={getElementById:id=>id==='joint-preview'?previewNode:submit,querySelectorAll:()=>[]};
 try{
  const state=createGame('lumen'),before=structuredClone(state),previews=[],commits=[];
  const controller=createSiteController({state:()=>state,phase:()=> 'decision',clearCompeting:()=>controller.clear(),select(){},rerender(){},focus(){},commit:id=>commits.push(id),preview:id=>previews.push(id)});
  controller.dispatch('open-facility',{country:'cera',site:'farm'});
  controller.input(siteRadio('upgrade'));
  assert.equal(controller.previewCommand(),null,'foreign direct facility orders stay unavailable');
  controller.dispatch('open-joint-investment',{country:'cera',site:'farm'});
  const input=(name,value)=>controller.input({target:{name,value:String(value),closest:selector=>selector==='#joint-form'?{id:'joint-form'}:null}});
  input('capital',28);input('share',25);input('duration',4);
  const expected=jointCommand({targetId:'cera',kind:'farm',capital:28,share:25,duration:4});
  assert.equal(controller.previewCommand(),expected);assert.equal(previews.at(-1),expected);
  input('capital',200);assert.equal(controller.previewCommand(),null);assert.equal(previews.at(-1),null);
  controller.clear();assert.equal(controller.previewCommand(),null);
  assert.deepEqual(commits,[]);assert.deepEqual(state,before);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

function mediationHarness(){
 const state=createGame('nord',{mediationStartTurn:1}),previews=[],commits=[];state.turn=1;
 state.goalConflicts=[{id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:0,startTurn:1,endTurn:8,duration:8,playerStance:null,stanceTurn:null,events:[],reason:'수출 목표 충돌'}];
 const before=structuredClone(state);
 const comparison={outerHTML:''},terms={innerHTML:''},result={innerHTML:''},submit={disabled:true,firstChild:{textContent:''}};
 const content={querySelector:selector=>({'#mediation-comparison':comparison,'#mediation-terms':terms,'#mediation-preview':result,'#send-mediation':submit}[selector]??null)};
 const controller=createMediationController({state:()=>state,resolveAction:id=>getAction(state,id),decisionContent:()=>content,clearCompeting(){},rerender(){},commit:id=>commits.push(id),focus(){},preview:id=>previews.push(id)});
 return {state,before,controller,previews,commits};
}

test('mediation preview command follows live draft input without committing or mutating the game',()=>{
 const OriginalFormData=globalThis.FormData;
 globalThis.FormData=class{constructor(target){this.target=target;}get(key){return this.target.values[key]??null;}};
 try{
  const {state,before,controller,previews,commits}=mediationHarness();
  assert.equal(controller.previewCommand(),null);
  controller.open('goal-conflict-cera-lumen-1');
  assert.match(controller.previewCommand(),/^mediate:/);
  const form={values:{conflictId:'goal-conflict-cera-lumen-1',goal:'relief',condition:'mutual',food:8,money:6}};
  controller.input({target:{closest:selector=>selector==='#mediation-form'?form:null}});
  assert.equal(previews.at(-1),controller.previewCommand());assert.match(previews.at(-1),/^mediate:/);
  assert.deepEqual(commits,[]);assert.deepEqual(state,before);
  controller.clear();assert.equal(controller.previewCommand(),null);
 }finally{globalThis.FormData=OriginalFormData;}
});

test('sanction review exposes its canonical preview command and clearing removes it without execution',()=>{
 const state=createGame('nord',{peaceComplianceStartTurn:1});state.turn=2;
 state.goalConflicts=[{id:'conflict-breach',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:0,startTurn:1,endTurn:8,duration:8,events:[],reason:'충돌'}];
 state.peaceAccords=[{id:'peace-accord-cera-lumen-2',conflictId:'conflict-breach',principalIds:['cera','lumen'],createdTurn:0,startTurn:1,endTurn:8,status:'violated',terms:{goal:'peace',condition:'mutual',food:4,money:6},obligation:'교역 유지',checks:[],events:[],violation:{countryId:'cera',turn:2,startsTurn:3,untilTurn:5,reason:'합의 위반'},response:null}];
 const before=structuredClone(state),commits=[];
 const controller=createMediationController({state:()=>state,resolveAction:id=>getAction(state,id),decisionContent:()=>({querySelector(){return null;}}),clearCompeting(){},rerender(){},commit:id=>commits.push(id),focus(){}});
 controller.reviewSanction('peace-accord-cera-lumen-2');
 assert.equal(controller.previewCommand(),'peace-compliance:peace-accord-cera-lumen-2:sanction');
 assert.deepEqual(commits,[]);assert.deepEqual(state,before);
 controller.clear();assert.equal(controller.previewCommand(),null);
});

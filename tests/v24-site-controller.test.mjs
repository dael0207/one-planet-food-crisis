import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn} from '../dist/engine.mjs';
import {createSiteController} from '../dist/site-controller.mjs';
import {renderSiteResults} from '../dist/site-ui.mjs';

function mounted(run){
 const previous=globalThis.document,execute={disabled:true},status={textContent:''};
 globalThis.document={getElementById:id=>id==='site-execute'?execute:status,querySelectorAll:()=>[]};
 try{let state=createGame('lumen'),phase='decision',commits=[];const context={state:()=>state,phase:()=>phase,clearCompeting(){controller.clear();},select(){},rerender(){},focus(){},commit(command){commits.push(command);state=advanceTurn(state,command);phase='result';}};const controller=createSiteController(context);run({controller,execute,status,commits,state:()=>state,phase:value=>{phase=value;}});}
 finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}
const radio=value=>({target:{value,closest:()=>({id:'site-form'})}});
const submit={target:{id:'site-form'}};

test('mounted own site selection commits the exact canonical command once without spending during inspection',()=>mounted(({controller,execute,commits,state})=>{
 const before=structuredClone(state());controller.dispatch('open-facility',{country:'lumen',site:'city'});
 assert.deepEqual(state(),before);assert.deepEqual(controller.selection(),{countryId:'lumen',kind:'city'});
 controller.input(radio('upgrade'));assert.equal(execute.disabled,false);assert.deepEqual(state(),before);
 controller.submit(submit);assert.deepEqual(commits,['site:city:upgrade']);assert.equal(state().turn,1);assert.equal(state().projects[0].siteKind,'city');
 controller.submit(submit);assert.equal(commits.length,1);
}));

test('mounted foreign inspection and result inspection cannot execute even forged form events',()=>mounted(({controller,execute,commits,state,phase})=>{
 const before=structuredClone(state());controller.dispatch('open-facility',{country:'cera',site:'port'});
 assert.ok(!controller.render().includes('id="site-form"'));controller.input(radio('upgrade'));controller.submit(submit);assert.equal(execute.disabled,true);assert.equal(commits.length,0);
 phase('result');controller.dispatch('open-facility',{country:'lumen',site:'farm'});controller.input(radio('manage'));controller.submit(submit);assert.equal(commits.length,0);assert.ok(!controller.render().includes('id="site-form"'));
 controller.dispatch('close-facility',{});assert.equal(controller.isOpen(),false);assert.deepEqual(state(),before);
}));

test('construction result owns one event while actual management and passive records remain inspectable',()=>{
 const started=advanceTurn(createGame('lumen'),'site:farm:upgrade');const html=renderSiteResults(started);
 assert.equal((html.match(/data-site-result="started"/g)??[]).length,1);assert.ok(!html.includes('<details>'));
 const completed=advanceTurn(advanceTurn(started,'maintain'),'maintain');const managed=advanceTurn(completed,'site:city:manage');
 const later=renderSiteResults(managed);assert.ok(later.includes('<details>'));assert.equal(managed.history.at(-1).siteOperations.filter(item=>['manage','passive'].includes(item.operation)).length,2);
});

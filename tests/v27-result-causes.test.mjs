import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame,jointCommand,peaceComplianceCommand} from '../dist/engine.mjs';
import {proposalCommand} from '../dist/negotiations.mjs';
import {mediationCommand} from '../dist/mediation.mjs';
import {renderResultCauses,resultCauses} from '../dist/result-causes.mjs';

const quiet={networkStartTurn:999,policyStartTurn:999,objectiveStartTurn:999,worldGoalStartTurn:999,conflictStartTurn:999,mediationStartTurn:999,peaceOfferStartTurn:999,peaceComplianceStartTurn:999,peaceResponseStartTurn:999,foreignSiteStartTurn:1,jointStartTurn:1};

const reconciles=metric=>metric.policyEffect+metric.remainder===metric.delta;

test('an executed construction decision names its real cost, deferred completion and reconciled totals',()=>{
 const state=advanceTurn(createGame('lumen',quiet),'invest'),before=structuredClone(state),model=resultCauses(state);

 assert.equal(model.action.label,'관개 시설 투자');
 assert.equal(model.action.actualCost,state.history.at(-1).actionCost);
 assert.match(model.action.outcome,/착공/);
 assert.match(model.action.timing,/2031년 3분기부터.+\+4\/분기/);
 assert.equal(model.events.some(event=>event.kind==='started'),false);
 assert.equal(reconciles(model.metrics.food),true);
 assert.equal(reconciles(model.metrics.treasury),true);
 assert.deepEqual(state,before);
});

test('completion is a visible real event and uses the completed quarter calendar',()=>{
 let state=advanceTurn(createGame('lumen',quiet),'invest');
 state=advanceTurn(state,'maintain');state=advanceTurn(state,'maintain');
 const model=resultCauses(state),completed=model.events.find(event=>event.kind==='completed');

 assert.ok(completed);
 assert.match(completed.title,/관개 시설/);
 assert.match(completed.detail,/2031년 3분기/);
});

test('accepted and rejected joint investments use canonical event impact instead of nominal terms',()=>{
 const accepted=advanceTurn(createGame('lumen',quiet),jointCommand({targetId:'nord',kind:'farm',capital:20,share:25,duration:8}));
 const rejected=advanceTurn(createGame('lumen',quiet),jointCommand({targetId:'cera',kind:'port',capital:12,share:75,duration:4}));
 const acceptedModel=resultCauses(accepted),rejectedModel=resultCauses(rejected);

 assert.equal(acceptedModel.action.actualCost,20);
 assert.equal(acceptedModel.action.costLabel,'실제 지출');
 assert.match(acceptedModel.action.outcome,/수락|착공/);
 assert.match(acceptedModel.action.timing,/2031년 3분기/);
 assert.equal(acceptedModel.events.some(event=>event.kind==='accepted'),false);
 assert.equal(rejectedModel.action.actualCost,0);
 assert.match(rejectedModel.action.outcome,/거절/);
 assert.equal(rejectedModel.action.timing,null);
});

test('policy effect is labeled as a maintain counterfactual while the remainder stays neutral',()=>{
 const model=resultCauses(advanceTurn(createGame('lumen',quiet),'subsidy'));

 assert.equal(model.comparisonLabel,'기존 정책 유지 대비 차이');
 assert.equal(model.remainderLabel,'그 밖의 분기 변화');
 assert.doesNotMatch(model.remainderLabel,/기후|날씨/);
 assert.equal(reconciles(model.metrics.food),true);
 assert.equal(reconciles(model.metrics.treasury),true);
});

test('an accepted negotiation reports the settled payment rather than its zero command cost',()=>{
 const state=createGame('lumen',{...quiet,worldGoalStartTurn:999});
 state.relations['cera:lumen']=100;state.countries.lumen.food=80;state.countries.lumen.treasury=80;state.countries.cera.food=80;state.countries.cera.treasury=80;
 const next=advanceTurn(state,proposalCommand({targetId:'cera',kind:'buy',food:3,money:6})),model=resultCauses(next);

 assert.equal(next.history.at(-1).actionCost,0);
 assert.equal(model.action.actualCost,6);
 assert.equal(model.action.actualFood,0);
 assert.match(model.action.outcome,/세라.+수락/);
 assert.ok(model.events.some(event=>event.kind==='diplomacy'&&event.detail.includes('식량 3')));
});

test('unrelated same-turn negotiation records cannot replace a maintain decision',()=>{
 const state=advanceTurn(createGame('lumen',quiet),'maintain');
 state.negotiations=[{id:'foreign-noise',targetId:'cera',kind:'buy',createdTurn:state.turn,resolvedTurn:state.turn,status:'accepted',settlement:{foodDelta:4,moneyDelta:-12}}];
 const model=resultCauses(state);

 assert.equal(model.action.label,'기존 정책 유지');
 assert.equal(model.action.costLabel,'명령 비용');
 assert.doesNotMatch(model.action.outcome,/세라|협상 수락/);
});

test('an incoming foreign peace offer cannot be attributed to a domestic policy command',()=>{
 const state=advanceTurn(createGame('lumen',{...quiet,policyStartTurn:1}),'balanced');
 state.history.at(-1).worldActions.push({source:'peace_offer',countryId:'marin',targetId:'lumen',text:'마린이 제재 완화 협상을 먼저 제안했습니다.'});
 const model=resultCauses(state);

 assert.equal(model.action.label,state.history.at(-1).actionLabel);
 assert.equal(model.action.outcome,'명령 실행 완료');
 assert.doesNotMatch(JSON.stringify(model.events),/마린|제재 완화 협상을 먼저 제안/);
 assert.ok(model.events.some(event=>event.title==='외교 신뢰'&&event.detail.includes('유지 대비 +4')));
 assert.ok(model.events.some(event=>event.title==='노르드 관계'&&event.detail.includes('73 → 79')&&event.detail.includes('유지 대비 +6')));
});

test('an accepted treaty reports this quarters canonical payment and fulfilled transfer',()=>{
 const state=advanceTurn(createGame('lumen',{...quiet,worldGoalStartTurn:999}),'treaty:nord:trade_buy:3:6:4'),model=resultCauses(state);

 assert.equal(state.history.at(-1).actionCost,0);
 assert.equal(model.action.actualCost,6);
 assert.equal(model.action.actualFood,0);
 assert.match(model.action.outcome,/장기 협정 수락/);
 assert.ok(model.events.some(event=>event.kind==='treaty'&&event.detail.includes('식량 3')));
});

test('accepted peace uses capped canonical aid instead of nominal draft terms',()=>{
 const state=createGame('nord',{...quiet,conflictStartTurn:1,mediationStartTurn:1});state.turn=2;state.goalConflicts=[{id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:1,startTurn:2,endTurn:8,duration:6,playerStance:null,stanceTurn:null,events:[],reason:'test'}];state.conflictCooldownUntil=10;state.countries.cera.food=99;state.countries.lumen.food=100;
 const command=mediationCommand({conflictId:state.goalConflicts[0].id,goal:'relief',condition:'mutual',food:8,money:12}),next=advanceTurn(state,command),model=resultCauses(next);

 assert.equal(next.mediations.at(-1).status,'accepted');
 assert.equal(model.action.actualFood,1);
 assert.equal(model.action.actualCost,12);
 assert.match(model.action.outcome,/합의 수락/);
});

test('a player re-sanction is bound to the chosen accord and canonical zero cost',()=>{
 const state=createGame('nord',{...quiet,conflictStartTurn:1,mediationStartTurn:1,peaceComplianceStartTurn:1});state.turn=2;state.goalConflicts=[{id:'goal-conflict-cera-lumen-1',status:'active',type:'trade_sanctions',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],formedTurn:1,startTurn:2,endTurn:9,duration:7,playerStance:null,stanceTurn:null,events:[],reason:'test'}];state.conflictCooldownUntil=12;state.relations['cera:nord']=84;state.relations['lumen:nord']=84;
 let next=advanceTurn(state,mediationCommand({conflictId:state.goalConflicts[0].id,goal:'peace',condition:'mutual',food:8,money:12}));next.countries.cera.food=8;next.countries.cera.price=190;next.reliability.cera=5;next.relations['cera:lumen']=8;next.relations['cera:nord']=10;next=advanceTurn(next,'maintain');
 const accord=next.peaceAccords.find(item=>item.status==='violated'),command=peaceComplianceCommand(accord.id,'sanction'),result=advanceTurn(next,command),model=resultCauses(result);

 assert.equal(model.action.actualCost,0);
 assert.equal(model.action.actualFood,0);
 assert.equal(model.action.outcome,'합의 위반에 재제재 실행');
 assert.ok(model.events.some(event=>event.kind==='peace'&&event.detail.includes('3회 실행')));
});

test('a managed map facility exposes its canonical resource event and actual charge',()=>{
 const state=advanceTurn(createGame('lumen',quiet),'site:farm:manage'),model=resultCauses(state);

 assert.equal(model.action.actualCost,6);
 assert.equal(model.action.outcome,'현장 운영 완료');
 assert.ok(model.events.some(event=>event.kind==='site'&&event.detail.includes('식량 +5')));
 assert.equal(reconciles(model.metrics.food),true);
});

test('rendering foregrounds facts, keeps exact arithmetic optional and escapes recorded copy',()=>{
 const state=advanceTurn(createGame('lumen',quiet),'invest');
 state.history.at(-1).actionLabel='<img src=x onerror=alert(1)>';
 const before=structuredClone(state),html=renderResultCauses(state);

 assert.match(html,/data-result-causes/);
 assert.match(html,/내 결정이 만든 결과/);
 assert.match(html,/기존 정책 유지 대비/);
 assert.match(html,/data-cause-totals/);
 assert.match(html,/68.+57.+[-−]11/s);
 assert.match(html,/명령 차이.+나머지/s);
 assert.ok(html.indexOf('data-cause-totals')<html.indexOf('<details'));
 assert.match(html,/<details/);
 assert.match(html,/식량.+[+−-]\d+/s);
 assert.doesNotMatch(html,/<img/);
 assert.match(html,/&lt;img/);
 assert.deepEqual(state,before);
});

test('a state without a completed quarter renders nothing',()=>{
 const state=createGame('lumen',quiet),before=structuredClone(state);
 assert.equal(resultCauses(state),null);
 assert.equal(renderResultCauses(state),'');
 assert.deepEqual(state,before);
});

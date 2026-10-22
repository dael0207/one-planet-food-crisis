import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,applyJointInvestmentDecision,COUNTRY_IDS,createGame,getAction,jointCommand,previewJointInvestment,runJointInvestments} from '../dist/engine.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {loadGame,saveGame,savedCountries} from '../dist/storage.mjs';

const KEY='one-planet-food-crisis-v4';
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
beforeEach(()=>values.clear());
const quiet={networkStartTurn:999,policyStartTurn:999,objectiveStartTurn:999,worldGoalStartTurn:999,conflictStartTurn:999,mediationStartTurn:999,peaceOfferStartTurn:999,peaceComplianceStartTurn:999,peaceResponseStartTurn:999,foreignSiteStartTurn:1,jointStartTurn:1};
const accepted={targetId:'nord',kind:'farm',capital:20,share:25,duration:8};
const rejected={targetId:'cera',kind:'port',capital:12,share:75,duration:4};
const treasuryTotal=state=>COUNTRY_IDS.reduce((sum,id)=>sum+state.countries[id].treasury,0);

test('Given valid terms When a joint investment is reviewed Then its canonical command becomes an accepted action',()=>{
 const state=createGame('lumen',quiet),preview=previewJointInvestment(state,accepted);
 const action=getAction(state,jointCommand(accepted));

 assert.deepEqual(preview.draft,accepted);assert.equal(preview.outcome,'accepted');assert.equal(preview.cost,20);assert.equal(preview.expectedFood,1);assert.equal(preview.dueTurn,3);assert.equal(preview.endTurn,11);
 assert.equal(action.jointInvestment.targetId,'nord');assert.equal(action.cost,20);
});

test('Given malformed or stale input When commands are parsed Then no authority can be forged',()=>{
 const state=createGame('lumen',quiet),action=getAction(state,jointCommand(accepted)),execution=structuredClone(state);execution.turn=1;execution.countries.lumen.treasury-=action.cost;

 assert.equal(jointCommand({...accepted,capital:13}),null);assert.equal(getAction(state,'join:nord:farm:020:25:8'),null);assert.equal(getAction(state,'join:lumen:farm:20:25:8'),null);assert.equal(getAction(state,'join:nord:city:20:25:8'),null);
 assert.throws(()=>applyJointInvestmentDecision(execution,{...action,cost:0},[],[]),/위조된/);
 const stale=structuredClone(execution);stale.relations['lumen:nord']=20;assert.throws(()=>applyJointInvestmentDecision(stale,action,[],[]),/변경되었거나/);
});

test('Given excellent relations but unsafe host finance When terms are scored Then reserve and cap constraints force rejection',()=>{
 const capped=createGame('lumen',quiet);capped.relations['lumen:nord']=100;capped.countries.nord.treasury=95;capped.countries.nord.food=20;
 const depleted=createGame('lumen',quiet);depleted.relations['lumen:nord']=100;depleted.countries.nord.treasury=0;depleted.countries.nord.food=20;

 const capPreview=previewJointInvestment(capped,{targetId:'nord',kind:'farm',capital:28,share:25,duration:12}),reservePreview=previewJointInvestment(depleted,{targetId:'nord',kind:'port',capital:12,share:25,duration:12});

 assert.equal(capPreview.score,100);assert.equal(capPreview.outcome,'rejected');assert.equal(capPreview.cost,0);assert.ok(capPreview.reasons.some(reason=>reason.includes('국고 상한')));
 assert.equal(reservePreview.score>=70,true);assert.equal(reservePreview.outcome,'rejected');assert.equal(reservePreview.cost,0);assert.ok(reservePreview.reasons.some(reason=>reason.includes('비축 국고')));
});

test('Given rejected but eligible terms When the quarter advances Then no investment capital is charged',()=>{
 const state=createGame('lumen',quiet),preview=previewJointInvestment(state,rejected),baseline=advanceTurn(state,'maintain'),poor=structuredClone(state);poor.countries.lumen.treasury=0;
 const next=advanceTurn(state,jointCommand(rejected));

 assert.equal(preview.eligible,true);assert.equal(preview.outcome,'rejected');assert.equal(getAction(state,jointCommand(rejected)).cost,0);assert.equal(previewJointInvestment(poor,rejected).affordable,false);assert.equal(previewJointInvestment(poor,rejected).cost,0);
 assert.equal(next.countries.lumen.treasury,baseline.countries.lumen.treasury);assert.equal(next.jointInvestments,undefined);assert.equal(next.history.at(-1).actionCost,0);
 assert.equal(next.history.at(-1).jointInvestmentEvents[0].operation,'rejected');assert.deepEqual(next.history.at(-1).jointInvestmentEvents[0].playerImpact,{food:0,treasury:0});
});

test('Given accepted farm terms When construction and settlement run Then real foreign capacity and conserved economics back the return',()=>{
 const initial=createGame('lumen',quiet),preview=previewJointInvestment(initial,accepted),baseline=advanceTurn(initial,'maintain');
 let state=advanceTurn(initial,jointCommand(accepted));

 assert.equal(treasuryTotal(state),treasuryTotal(baseline)-preview.constructionCost);assert.equal(state.countries.lumen.treasury,baseline.countries.lumen.treasury-accepted.capital);
 assert.equal(state.foreignSites.nord.farm.project.dueTurn,3);assert.equal(state.jointInvestments[0].status,'building');assert.equal(state.jointInvestments[0].totalFood,0);
 state=advanceTurn(state,'maintain');assert.equal(state.jointInvestments[0].totalFood,0);
 state=advanceTurn(state,'maintain');assert.equal(state.foreignSites.nord.farm.level,1);assert.equal(state.foreignSites.nord.farm.project,null);assert.equal(state.jointInvestments[0].status,'active');assert.equal(state.jointInvestments[0].totalFood,0);
 state=advanceTurn(state,'maintain');assert.equal(state.jointInvestments[0].totalFood,1);
 const shipment=state.history.at(-1).jointInvestmentEvents.find(item=>item.operation==='settlement');assert.equal(shipment.type,'trade');assert.equal(shipment.shipmentFromId,'nord');assert.equal(shipment.shipmentToId,'lumen');assert.deepEqual(shipment.playerImpact,{food:1,treasury:0});
});

test('Given four quarters of three food at a 25 percent share When entitlements accrue Then exactly three food is paid',()=>{
 const state=createGame('lumen',quiet);state.turn=3;state.countries.lumen.food=50;state.countries.nord.food=80;state.jointInvestments=[{id:'joint-lumen-nord-farm-1',targetId:'nord',kind:'farm',capital:20,share:25,duration:4,startTurn:3,dueTurn:3,endTurn:7,status:'active',totalFood:0,totalRevenue:0,lastReason:'active'}];

 for(let turn=3;turn<7;turn++){state.turn=turn;runJointInvestments(state,[],[{source:'foreign_site',countryId:'nord',kind:'farm',operation:'passive',food:3,money:2,text:'format independent'}]);if(turn===3)assert.equal(state.jointInvestments[0].lastReason,'소수 배분 몫 이월');}

 assert.equal(state.jointInvestments[0].accruedOutput,12);assert.equal(state.jointInvestments[0].accountedEntitlement,3);assert.equal(state.jointInvestments[0].totalFood,3);assert.equal(state.countries.lumen.food,53);assert.equal(state.countries.nord.food,77);
});

test('Given port passive output When revenue settles Then only actual net money is shareable without reading event prose',()=>{
 const state=createGame('lumen',quiet);state.turn=3;state.countries.lumen.treasury=40;state.countries.nord.treasury=70;state.jointInvestments=[{id:'joint-lumen-nord-port-1',targetId:'nord',kind:'port',capital:20,share:50,duration:4,startTurn:3,dueTurn:3,endTurn:7,status:'active',totalFood:0,totalRevenue:0,lastReason:'active'}];

 runJointInvestments(state,[],[{source:'foreign_site',countryId:'nord',kind:'port',operation:'passive',food:0,money:2,text:'문구와 단계 숫자가 없어도 됩니다'}]);

 assert.equal(state.jointInvestments[0].accruedOutput,2);assert.equal(state.jointInvestments[0].totalRevenue,1);assert.equal(state.countries.lumen.treasury,41);assert.equal(state.countries.nord.treasury,69);
});

test('Given actual output but binding reserves and storage caps When a farm share settles Then loss is bounded and never becomes debt',()=>{
 const state=createGame('lumen',quiet);state.turn=3;state.countries.lumen.food=100;state.countries.nord.food=21;state.jointInvestments=[{id:'joint-lumen-nord-farm-1',targetId:'nord',kind:'farm',capital:20,share:75,duration:4,startTurn:3,dueTurn:3,endTurn:7,status:'active',totalFood:0,totalRevenue:0,lastReason:'active'}];
 const parts=[],actions=[{source:'foreign_site',countryId:'nord',kind:'farm',operation:'passive',food:4,money:2,text:'output'}];
 const settled=runJointInvestments(state,parts,actions);state.turn=4;state.countries.lumen.food=50;runJointInvestments(state,parts,[{source:'foreign_site',countryId:'nord',kind:'farm',operation:'passive',food:0,money:0,text:'none'}]);

 assert.deepEqual(settled,[{contractId:'joint-lumen-nord-farm-1',food:0,revenue:0}]);assert.equal(state.jointInvestments[0].accountedEntitlement,3);assert.equal(state.jointInvestments[0].totalFood,0);assert.equal(state.countries.nord.food,21);assert.equal(parts.length,0);
});

test('Given sanctions and damaged relations When quarters settle Then supply suspends, resumes only at 45, and expires on schedule',()=>{
 const state=createGame('lumen',quiet);state.turn=3;state.jointInvestments=[{id:'joint-lumen-nord-farm-1',targetId:'nord',kind:'farm',capital:20,share:50,duration:4,startTurn:3,dueTurn:3,endTurn:7,status:'active',totalFood:0,totalRevenue:0,lastReason:'active'}];state.conflictStartTurn=1;state.goalConflicts=[{id:'blocked',status:'active',type:'trade_sanctions',initiatorId:'nord',targetId:'lumen',sanctionMembers:['nord'],responseMembers:['lumen'],formedTurn:2,startTurn:3,endTurn:6,duration:3,playerStance:null,stanceTurn:null,events:[],reason:'test'}];

 let actions=[];runJointInvestments(state,[],actions);assert.equal(state.jointInvestments[0].status,'suspended');assert.equal(actions.at(-1).operation,'suspended');
 state.turn=4;state.goalConflicts=[];state.relations['lumen:nord']=44;actions=[];runJointInvestments(state,[],actions);assert.equal(state.jointInvestments[0].status,'suspended');assert.equal(actions.length,0);
 state.turn=5;state.relations['lumen:nord']=45;actions=[{source:'foreign_site',countryId:'nord',kind:'farm',operation:'passive',food:3,money:2,text:'output'}];runJointInvestments(state,[],actions);assert.equal(state.jointInvestments[0].status,'active');assert.ok(actions.some(item=>item.operation==='resumed'));
 state.turn=7;actions=[];runJointInvestments(state,[],actions);assert.equal(state.jointInvestments[0].status,'completed');assert.equal(actions[0].operation,'completed');
});

test('Given six national save slots When joint actions are persisted Then replay restores every canonical campaign',()=>{
 const originals=new Map();
 for(const playerId of COUNTRY_IDS){const state=createGame(playerId),candidate=COUNTRY_IDS.filter(id=>id!==playerId).flatMap(targetId=>['farm','port'].map(kind=>({targetId,kind,capital:20,share:25,duration:4}))).map(draft=>previewJointInvestment(state,draft)).filter(item=>item.outcome==='accepted').sort((a,b)=>b.score-a.score)[0];assert.ok(candidate,playerId);const advanced=advanceTurn(state,jointCommand(candidate.draft));saveGame(advanced,{phase:'result',step:0});originals.set(playerId,advanced);}

 assert.equal(Object.keys(savedCountries()).length,6);for(const [playerId,state] of originals)assert.deepEqual(loadGame(playerId).state,state);
});

test('Given a pre-V26 slot When it loads Then the lazy gate prevents retroactive joint state and rejects invalid metadata',()=>{
 values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:{playerId:'lumen',actions:['maintain','maintain'],phase:'result',step:0}}}));
 const loaded=loadGame('lumen');

 assert.equal(loaded.status,'restored');assert.equal(loaded.state.jointStartTurn,3);assert.equal(loaded.state.jointInvestments,undefined);assert.ok(loaded.state.history.every(record=>record.jointInvestmentEvents===undefined));
 for(const jointStartTurn of [0,-1,1.5,4,'1']){values.set(KEY,JSON.stringify({version:4,activePlayerId:'lumen',games:{lumen:{playerId:'lumen',actions:['maintain','maintain'],jointStartTurn,phase:'result',step:0}}}));assert.equal(loadGame('lumen').status,'invalid');}
});

test('Given a command-derived joint campaign When its chronicle replays Then final economics and cost are exact without mutation',()=>{
 let state=createGame('lumen',quiet);state=advanceTurn(state,jointCommand(accepted));state=advanceTurn(state,'maintain');state=advanceTurn(state,'maintain');const before=structuredClone(state);
 const chronicle=buildChronicle(state);

 assert.deepEqual(state,before);assert.deepEqual(chronicle.points.at(-1).metrics,Object.fromEntries(['food','treasury','price','trust','approval'].map(key=>[key,state.countries.lumen[key]])));assert.equal(chronicle.points[1].investmentCost,20);assert.equal(chronicle.points.at(-1).cumulativeInvestmentCost,20);
});

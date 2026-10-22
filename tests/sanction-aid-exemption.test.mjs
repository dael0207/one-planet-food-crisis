import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../dist/engine.mjs';
import {runForeignDiplomacy} from '../dist/foreign-diplomacy.mjs';
import {tradeBlocked} from '../dist/goal-conflicts.mjs';

function isolated({blocked=true,sellerFood=58,buyerFood=30}={}){
 const state=createGame('nord');state.turn=3;
 for(const country of Object.values(state.countries)){country.food=50;country.treasury=50;}
 for(const key of Object.keys(state.relations))state.relations[key]=0;
 state.relations['cera:lumen']=70;state.countries.cera.food=sellerFood;state.countries.lumen.food=buyerFood;
 if(blocked)state.goalConflicts=[{id:'aid-exemption',status:'active',initiatorId:'cera',targetId:'lumen',sanctionMembers:['cera'],responseMembers:['lumen'],startTurn:2,endTurn:8,playerStance:null}];
 return state;
}

test('opposing sanction blocs can form the same humanitarian alliance as an unrestricted eligible pair',()=>{
 const open=isolated({blocked:false}),blocked=isolated();
 runForeignDiplomacy(open);runForeignDiplomacy(blocked);
 assert.equal(open.foreignTreaties[0]?.kind,'alliance');
 assert.equal(blocked.foreignTreaties[0]?.kind,'alliance','sanctions incorrectly suppressed autonomous humanitarian alliance formation');
 assert.deepEqual(blocked.foreignTreaties.map(item=>[item.playerId,item.targetId,item.kind]),open.foreignTreaties.map(item=>[item.playerId,item.targetId,item.kind]));
 assert.equal(tradeBlocked(blocked,'cera','lumen'),true);
});

test('aid exemption does not reopen autonomous commercial treaty formation between sanction blocs',()=>{
 const open=isolated({blocked:false,sellerFood:75,buyerFood:55}),blocked=isolated({sellerFood:75,buyerFood:55});
 runForeignDiplomacy(open);runForeignDiplomacy(blocked);
 assert.equal(open.foreignTreaties[0]?.kind,'trade_sell');assert.equal(blocked.foreignTreaties.length,0);
});

test('a newly formed humanitarian alliance actually delivers conserved food across a trade restriction',()=>{
 const state=isolated();runForeignDiplomacy(state);const treaty=state.foreignTreaties[0];assert.ok(treaty,'humanitarian alliance must form before its first execution');
 const before=Object.values(state.countries).reduce((sum,country)=>sum+country.food,0),actions=[];
 state.turn=4;runForeignDiplomacy(state,actions);
 assert.equal(treaty.fulfilled,1);assert.equal(treaty.breaches,0);assert.equal(tradeBlocked(state,'cera','lumen'),true);
 assert.ok(actions.some(action=>action.type==='aid'&&action.countryId==='cera'&&action.targetId==='lumen'&&action.food>0));
 assert.equal(Object.values(state.countries).reduce((sum,country)=>sum+country.food,0),before);
 assert.ok(!actions.some(action=>action.type==='trade'));
});

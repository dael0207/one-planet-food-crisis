import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTurn,createGame} from '../dist/engine.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {renderChronicle} from '../dist/chronicle-ui.mjs';

const play=(state,commands)=>commands.reduce((current,command)=>advanceTurn(current,command),state);

test('real Lumen objective achievement is preserved at its exact quarter and rendered with its unlock',()=>{
 const state=play(createGame('lumen'),['balanced','invest','maintain','maintain']);
 const before=structuredClone(state),chronicle=buildChronicle(state),achievement=state.history.at(-1).objectiveAchievements[0];
 const point=chronicle.points.find(item=>item.turn===achievement.turn);

 assert.deepEqual(point.objectiveAchievements,[achievement]);
 assert.notStrictEqual(point.objectiveAchievements,achievement);
 assert.equal(point.objectiveCompleted,1);
 assert.equal(chronicle.points.at(-2).objectiveCompleted,0);

 const html=renderChronicle(chronicle,{turn:achievement.turn});
 assert.match(html,/국가 목표 1단계/);
 assert.ok(html.includes(achievement.title));
 assert.ok(html.includes(achievement.unlockName));
 assert.deepEqual(state,before);
});

test('lean replay carries objective state beyond bounded history without recounting achievements',()=>{
 let state=play(createGame('lumen'),['balanced','invest','maintain','maintain','mandate_lumen_1']);
 const achievement=structuredClone(state.history.find(record=>record.objectiveAchievements.length).objectiveAchievements[0]);
 state=play(state,Array(81).fill('maintain'));
 const before=structuredClone(state),chronicle=buildChronicle(state);

 assert.equal(state.history.length,80);
 assert.equal(chronicle.points.length,state.commands.length+1);
 assert.deepEqual(chronicle.points[4].objectiveAchievements,[achievement]);
 assert.equal(chronicle.points[4].objectiveCompleted,1);
 assert.equal(chronicle.points.at(-1).objectiveCompleted,state.objectives.completed.length);
 assert.equal(chronicle.points.filter(point=>point.objectiveAchievements.length).length,state.objectives.completed.length);
 assert.ok(chronicle.points.some(point=>point.policyId==='mandate_lumen_1'));
 assert.deepEqual(state,before);
});

test('objective activation boundary leaves legacy quarters empty and records the first real completion',()=>{
 const state=play(createGame('lumen',{objectiveStartTurn:5}),['balanced','invest','maintain','maintain','balanced']);
 const chronicle=buildChronicle(state);

 assert.deepEqual(chronicle.points.slice(0,5).map(point=>point.objectiveAchievements),[[],[],[],[],[]]);
 assert.equal(chronicle.points[4].objectiveCompleted,0);
 assert.equal(chronicle.points[5].objectiveAchievements[0].stage,1);
 assert.equal(chronicle.points[5].objectiveCompleted,1);
});

test('partial chronicles count only recorded achievements and never invent unknown prior goals',()=>{
 const complete=play(createGame('lumen'),['balanced','invest','maintain','maintain',...Array(81).fill('maintain')]);
 const partial=structuredClone(complete);delete partial.commands;
 const before=structuredClone(partial),chronicle=buildChronicle(partial);

 assert.equal(chronicle.coverage,'partial');
 assert.ok(partial.objectives.completed.length>0);
 assert.ok(chronicle.points.every(point=>point.objectiveCompleted===0));
 assert.ok(chronicle.points.every(point=>point.objectiveAchievements.length===0));
 assert.doesNotMatch(renderChronicle(chronicle),/국가 목표 \d단계/);
 assert.deepEqual(partial,before);
});

test('partial chronicles clone recorded achievements and omit an unlock name when it was not recorded',()=>{
 const state=play(createGame('lumen'),['balanced','invest','maintain','maintain']);
 const partial=structuredClone(state);delete partial.commands;
 delete partial.history.at(-1).objectiveAchievements[0].unlockName;
 const before=structuredClone(partial),chronicle=buildChronicle(partial),point=chronicle.points.at(-1);

 assert.deepEqual(point.objectiveAchievements,partial.history.at(-1).objectiveAchievements);
 assert.notStrictEqual(point.objectiveAchievements,partial.history.at(-1).objectiveAchievements);
 assert.equal(point.objectiveCompleted,1);
 const html=renderChronicle(chronicle,{turn:point.turn});
 assert.ok(html.includes(point.objectiveAchievements[0].title));
 assert.doesNotMatch(html,/해금 ·/);
 assert.deepEqual(partial,before);
});

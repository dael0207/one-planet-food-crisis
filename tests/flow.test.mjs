import test from 'node:test';
import assert from 'node:assert/strict';
import {beginReview,nextReview,canDecide} from '../dist/flow.mjs';
test('decisions pause for results before the next quarter',()=>{
 assert.deepEqual(beginReview(),{phase:'result',step:0});
 assert.equal(canDecide(beginReview(),1),false);
});
test('review stages return to decisions even after ten and four hundred quarters',()=>{
 for(const turn of [1,10,11,80,400]){
  let flow=beginReview();
  for(let i=1;i<=3;i++)flow=nextReview(flow,turn);
  assert.deepEqual(flow,{phase:'result',step:3});
  assert.deepEqual(nextReview(flow,turn),{phase:'decision',step:0});
 }
});
test('long-running governments can keep making decisions',()=>{
 assert.equal(canDecide({phase:'decision',step:0},400),true);
});

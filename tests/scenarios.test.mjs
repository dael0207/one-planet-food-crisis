import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advanceTurn, getAction, COUNTRY_IDS, PROFILES } from '../dist/engine.mjs?v=4';
import { getDomesticOrders, getScenario } from '../dist/scenarios.mjs?v=4';

const exclusive = {
  lumen: ['embargo', 'balanced'], nord: ['secure_imports', 'strategic_reserve'], cera: ['export_push', 'embargo'],
  altia: ['research', 'license'], marin: ['expand_routes', 'emergency_import'], solis: ['ration', 'resilience'],
};
const domestic = {
  ...exclusive,
  lumen: ['balanced', 'embargo', 'reopen', 'aid'],
  cera: ['export_push', 'embargo', 'reopen'],
};
const foodRelief = {
  lumen: 'embargo', nord: 'strategic_reserve', cera: 'embargo',
  altia: 'research', marin: 'emergency_import', solis: 'ration',
};

function assertThreeOrders(state, scenario) {
  const ids = scenario.options.map((item) => item.id);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.includes('maintain'));
  assert.ok(ids.every((id) => getAction(state, id)));
}

test('all six nations have a unique opening and two national choices', () => {
  const openings = COUNTRY_IDS.map((playerId) => {
    const state = createGame(playerId);
    const scenario = getScenario(state);
    assert.equal(state.playerId, playerId);
    assert.equal(scenario.title, PROFILES[playerId].openingTitle);
    assert.ok(scenario.description.length>10&&scenario.description.length<120,'opening briefing stays readable before the first choice');
    assert.doesNotMatch(scenario.description,/미응답 외교 요청|진행 중인 국제 협약/,'optional diplomacy does not crowd out the first decision');
    assert.deepEqual(scenario.options.map((item) => item.id), [...exclusive[playerId], 'maintain']);
    assert.ok(scenario.options.every((item) => getAction(state, item.id)));
    return `${scenario.title}|${scenario.description}`;
  });
  assert.equal(new Set(openings).size, 6);
});

test('every nation can run 80 quarters with three valid choices and a free continuation', () => {
  for (const playerId of COUNTRY_IDS) {
    let state = createGame(playerId);
    for (let turn = 0; turn <= 80; turn += 1) {
      const scenario = getScenario(state);
      assert.equal(scenario.options.length, 3, `${playerId} turn ${turn}`);
      assert.equal(new Set(scenario.options.map((item) => item.id)).size, 3);
      assert.ok(scenario.options.every((item) => getAction(state, item.id)));
      assert.ok(scenario.options.some((item) => { const action = getAction(state, item.id); return action.cost === 0 && (action.foodCost ?? 0) === 0; }));
      assert.ok(!JSON.stringify(scenario).includes('undefined'));
      if (turn < 80) state = advanceTurn(state, 'maintain');
    }
  }
});

test('national briefings react to scarcity, price, season and prior national choices', () => {
  for (const playerId of COUNTRY_IDS) {
    const base = createGame(playerId);
    base.turn = 12;
    const spring = getScenario(base);
    base.turn = 13;
    const summer = getScenario(base);
    assert.notEqual(spring.title, summer.title, playerId);
    const scarce = structuredClone(base);
    scarce.countries[playerId].food = 20;
    assert.notEqual(getScenario(scarce).title, summer.title, playerId);
    const after = advanceTurn(createGame(playerId), exclusive[playerId][0]);
    const followup = getScenario(after);
    if(after.activePolicy==='embargo')assert.ok(followup.options.some(option=>option.id==='reopen'));
    else assert.match(followup.title, /후속 효과|완공 전/);
    assert.notEqual(followup.title, PROFILES[playerId].openingTitle);
  }
});

test('urgent food relief takes priority for all six nations, including at opening', () => {
  for (const playerId of COUNTRY_IDS) {
    const state = createGame(playerId);
    state.countries[playerId].food = 37;

    const scenario = getScenario(state);
    const relieved = advanceTurn(state, foodRelief[playerId]);
    const maintained = advanceTurn(state, 'maintain');

    assert.equal(scenario.options[0].id, foodRelief[playerId], playerId);
    assert.ok(relieved.countries[playerId].food > maintained.countries[playerId].food, playerId);
    assertThreeOrders(state, scenario);
    assert.notEqual(scenario.title, PROFILES[playerId].openingTitle, playerId);
  }
});

test('urgent price relief takes priority for all six nations', () => {
  for (const playerId of COUNTRY_IDS) {
    const state = createGame(playerId);
    state.turn = 8;
    state.countries[playerId].price = 136;

    const scenario = getScenario(state);
    const relieved = advanceTurn(state, 'subsidy');
    const maintained = advanceTurn(state, 'maintain');

    assert.equal(scenario.options[0].id, 'subsidy', playerId);
    assert.ok(relieved.countries[playerId].price < maintained.countries[playerId].price, playerId);
    assertThreeOrders(state, scenario);
  }
});

test('embargo, projects and previous policy narration cannot mask urgent orders', () => {
  const cases = [
    Object.assign(createGame('lumen'), { turn: 5, activePolicy: 'embargo' }),
    Object.assign(createGame('altia'), { turn: 5, projects: [{ type: 'facility', countryId: 'altia', dueTurn: 7 }] }),
    advanceTurn(createGame('marin'), 'expand_routes'),
  ];
  for (const state of cases) {
    state.countries[state.playerId].food = 37;

    const scenario = getScenario(state);

    assert.equal(scenario.options[0].id, state.activePolicy==='embargo'?'maintain':foodRelief[state.playerId], state.playerId);
    assertThreeOrders(state, scenario);
  }
});

test('pending diplomatic request keeps precedence over urgent domestic conditions', () => {
  const state = createGame('solis');
  state.countries.solis.food = 0;
  state.countries.solis.price = 220;
  const request = state.requests.find((item) => item.fromId !== state.playerId && item.status === 'pending');

  const scenario = getScenario(state, request.id);

  assert.deepEqual(scenario.options.map((item) => item.id), ['accept', 'counter', 'decline'].map((reply) => `${reply}:${request.id}`));
});

test('domestic order catalog contains every valid own and shared policy exactly once', () => {
  for (const playerId of COUNTRY_IDS) {
    const state = createGame(playerId);
    const expected = new Set([...domestic[playerId].filter(id=>id!=='reopen'), 'subsidy', 'invest', 'maintain']);
    const before = JSON.stringify(state);

    const orders = getDomesticOrders(state);
    const ids = orders.map((item) => item.id);

    assert.deepEqual(new Set(ids), expected, playerId);
    assert.equal(JSON.stringify(state), before, playerId);
    assert.equal(ids.length, expected.size, playerId);
    assert.ok(orders.every((item) => getAction(state, item.id)), playerId);
    for (const foreignId of new Set(COUNTRY_IDS.filter((id) => id !== playerId).flatMap((id) => domestic[id]).filter((id) => !expected.has(id)))) {
      assert.equal(ids.includes(foreignId), false, `${playerId} received ${foreignId}`);
    }
  }
});

test('domestic order catalog filters invalid orders but keeps unaffordable ones', () => {
  const state = createGame('nord');
  state.projects.push({ type: 'facility', countryId: 'nord', dueTurn: 2 });
  state.countries.nord.treasury = 0;

  const ids = getDomesticOrders(state).map((item) => item.id);

  assert.equal(ids.includes('invest'), false);
  assert.ok(ids.includes('secure_imports'));
  assert.ok(ids.includes('strategic_reserve'));
  assert.ok(ids.includes('subsidy'));
});

test('a valid foreign request opens three responses without advancing time', () => {
  for (const playerId of COUNTRY_IDS) {
    const state = createGame(playerId);
    const request = state.requests.find((item) => item.fromId !== playerId && item.status === 'pending');
    assert.ok(request, playerId);
    const before = JSON.stringify(state);
    const scenario = getScenario(state, request.id);
    assert.deepEqual(scenario.options.map((item) => item.id), ['accept', 'counter', 'decline'].map((reply) => `${reply}:${request.id}`));
    assert.ok(scenario.options.every((item) => getAction(state, item.id)));
    assert.equal(JSON.stringify(state), before);
  }
});

test('own, invalid, expired and answered requests fall back to domestic policy', () => {
  const state = createGame('altia');
  const ownRequest = { ...state.requests[0], id: 'own-request', fromId: 'altia' };
  state.requests.push(ownRequest);
  assert.equal(getScenario(state, ownRequest.id).options.some((item) => item.id.startsWith('accept:')), false);
  assert.deepEqual(getScenario(state, 'forged-id'), getScenario(state));
  const foreign = state.requests.find((item) => item.fromId !== state.playerId);
  foreign.status = 'resolved';
  assert.deepEqual(getScenario(state, foreign.id), getScenario(state));
  foreign.status = 'pending';
  state.turn = foreign.expiresTurn;
  assert.deepEqual(getScenario(state, foreign.id), getScenario(state));
});

test('depleted countries still receive a free valid decision', () => {
  for (const playerId of COUNTRY_IDS) {
    const state = createGame(playerId);
    state.turn = 48;
    state.countries[playerId].treasury = 0;
    state.countries[playerId].food = 0;
    const scenario = getScenario(state);
    const free = scenario.options.find((item) => { const action = getAction(state, item.id); return action.cost === 0 && (action.foodCost ?? 0) === 0; });
    assert.ok(free, playerId);
    assert.equal(advanceTurn(state, free.id).turn, 49);
  }
});

test('both exporting nations can lift an ongoing restriction through visible decisions',()=>{
 for(const id of ['lumen','cera']){
  const restricted=advanceTurn(createGame(id),'embargo');
  assert.ok(getScenario(restricted).options.some(option=>option.id==='reopen'));
  assert.equal(advanceTurn(restricted,'reopen').activePolicy,'open');
 }
});

test('new orders exclude redundant toggles while historical replay remains compatible',()=>{
 for(const id of ['lumen','cera']){
  const open=createGame(id);
  assert.ok(!getDomesticOrders(open).some(order=>order.id==='reopen'));
  const restricted=advanceTurn(open,'embargo');
  restricted.countries[id].food=37;
  assert.ok(!getDomesticOrders(restricted).some(order=>order.id==='embargo'));
  const scenario=getScenario(restricted);
  assert.equal(scenario.options[0].id,'maintain');
  assert.equal(scenario.options[0].label,'수출 제한 유지');
  assert.ok(!scenario.options.some(order=>order.id==='embargo'));
  assert.deepEqual(advanceTurn(restricted,scenario.options[0].id),advanceTurn(restricted,'maintain'));
  // Past saves may contain old toggle commands; do not invalidate their deterministic replay.
  let historical=advanceTurn(open,'reopen');
  historical=advanceTurn(advanceTurn(historical,'embargo'),'embargo');
  assert.equal(historical.turn,3);
 }
});

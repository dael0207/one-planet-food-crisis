import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTRY_IDS,
  advanceTurn,
  cabinetAction,
  cabinetPlanFacts,
  createGame,
  currentAgenda,
  getAction,
  getPolicies,
  runCabinetFollowthrough,
} from '../dist/engine.mjs';
import {buildChronicle} from '../dist/chronicle-model.mjs';
import {getScenario} from '../dist/scenarios.mjs';
import {loadGame, saveGame} from '../dist/storage.mjs';

const quiet = {
  networkStartTurn: 999,
  policyStartTurn: 1,
  objectiveStartTurn: 999,
  worldGoalStartTurn: 999,
  conflictStartTurn: 999,
  mediationStartTurn: 999,
  peaceOfferStartTurn: 999,
  peaceComplianceStartTurn: 999,
  peaceResponseStartTurn: 999,
  foreignSiteStartTurn: 999,
  jointStartTurn: 999,
};
const ready = (playerId = 'lumen') => advanceTurn(advanceTurn(createGame(playerId, quiet), 'maintain'), 'maintain');

test('cabinet agendas begin after the opening and give every nation two consequential orders', () => {
  for (const playerId of COUNTRY_IDS) {
    assert.equal(currentAgenda(createGame(playerId, quiet)), null);
    const state = ready(playerId);
    const agenda = currentAgenda(state);
    assert.equal(agenda.family, `national:${playerId}`);
    assert.equal(agenda.options.length, 2);
    assert.equal(new Set(agenda.options.map(option => option.id)).size, 2);
    for (const option of agenda.options) {
      const action = getAction(state, option.id);
      assert.ok(action);
      assert.equal(action.source, 'cabinet');
      assert.ok(action.gain && action.sacrifice && action.forecast && action.origin);
      assert.deepEqual(action.tradeoffs, {gain: action.gain, sacrifice: action.sacrifice});
      assert.ok(action.plan.duration >= 2 && action.plan.duration <= 3);
      assert.ok(action.cost > 0 || action.foodCost > 0 || Object.values(action.immediate).some(value => value < 0));
    }
    assert.ok(getPolicies(state).some(action => action.id === 'maintain'));
  }
});

test('executing a cabinet order charges once and starts dated effects next quarter', () => {
  const state = ready('lumen');
  const action = currentAgenda(state).options[0];
  const baseline = advanceTurn(state, 'maintain');
  const started = advanceTurn(state, action.id);
  const startedRecord = started.history.at(-1);
  assert.equal(started.countries.lumen.treasury - baseline.countries.lumen.treasury, -action.cost);
  assert.equal(startedRecord.worldActions.some(item => item.source === 'cabinet' && item.operation === 'followthrough'), false);
  const decision = startedRecord.worldActions.find(item => item.source === 'cabinet' && item.operation === 'decision');
  assert.deepEqual(decision.plan, {startTurn: started.turn + 1, endTurn: started.turn + action.plan.duration, duration: action.plan.duration, effects: action.effects});
  assert.equal(decision.effects.treasury, (action.immediate.treasury ?? 0) - action.cost);
  assert.equal(decision.effects.food, (action.immediate.food ?? 0) - action.foodCost);
  assert.equal(started.cabinetPlans.length, 1);
  assert.equal(started.cabinetPlans[0].startTurn, started.turn + 1);
  const followed = advanceTurn(started, 'maintain');
  const followRecord = followed.history.at(-1);
  assert.ok(followRecord.worldActions.some(item => item.source === 'cabinet' && item.operation === 'followthrough'));
  assert.ok(followRecord.foodBreakdown.some(item => item.source === 'cabinet'));
  assert.equal(cabinetPlanFacts(followed)[0].remaining, started.cabinetPlans[0].endTurn - followed.turn);
  let completed = followed;
  while (completed.turn < started.cabinetPlans[0].endTurn) completed = advanceTurn(completed, 'maintain');
  assert.equal(cabinetPlanFacts(completed).length, 0);
});

test('cabinet validation rejects forged country, inactive family, stale stacking and cooldown bypasses', () => {
  const state = ready('nord');
  const action = currentAgenda(state).options[0];
  assert.equal(cabinetAction(state, action.id.replace(':nord:', ':cera:')), null);
  assert.equal(getAction(state, 'cabinet:fiscal:austerity'), null);
  const started = advanceTurn(state, action.id);
  assert.equal(getAction(started, action.id), null);
  const forged = structuredClone(started);
  forged.cabinetMemory.cooldowns[action.family] = forged.turn;
  assert.equal(getAction(forged, action.id), null);
});

test('follow-through records the actual bounded delta instead of a fictional headline amount', () => {
  const state = ready('lumen');
  state.countries.lumen.food = 99;
  state.cabinetPlans = [{id: 'bounded', family: 'surplus', actionId: 'cabinet:surplus:preserve', name: '잉여 수확 보존망', originatingTurn: 2, startTurn: 2, endTurn: 4, effects: {food: 3}}];
  const parts = [], actions = [];
  runCabinetFollowthrough(state, {parts, actions});
  assert.equal(state.countries.lumen.food, 100);
  assert.deepEqual(parts, [{label: '잉여 수확 보존망 후속 효과', value: 1, source: 'cabinet'}]);
  assert.deepEqual(actions[0].effects, {food: 1});
});

test('resource conditions select different shared dilemmas without a turn-pattern rotation', () => {
  const fiscal = ready('altia');
  fiscal.countries.altia.treasury = 24;
  assert.equal(currentAgenda(fiscal).family, 'fiscal');
  const subsidy = ready('marin');
  subsidy.countries.marin.price = 132;
  subsidy.activePolicy = 'embargo';
  assert.equal(currentAgenda(subsidy).family, 'subsidy');
  const surplus = ready('cera');
  surplus.countries.cera.food = 76;
  assert.equal(currentAgenda(surplus).family, 'surplus');
  assert.equal(currentAgenda({...surplus, turn: surplus.turn + 8}).family, 'surplus');
});

test('recent decisions change the active dilemma even when national resources stay equal', () => {
  const national = ready('lumen');
  const repeatedSubsidy = structuredClone(national);
  repeatedSubsidy.history = repeatedSubsidy.history.slice(0, -2).concat([
    {...repeatedSubsidy.history.at(-2), policyId: 'subsidy', actionCost: 12},
    {...repeatedSubsidy.history.at(-1), policyId: 'subsidy', actionCost: 12},
  ]);
  const costlyRun = structuredClone(national);
  costlyRun.history = [...costlyRun.history, {policyId: 'invest', actionCost: 31}];
  assert.equal(currentAgenda(national).family, 'national:lumen');
  assert.equal(currentAgenda(repeatedSubsidy).family, 'subsidy');
  assert.equal(currentAgenda(costlyRun).family, 'fiscal');
  assert.notDeepEqual(currentAgenda(repeatedSubsidy).options.map(action => action.id), currentAgenda(national).options.map(action => action.id));
});

test('a lasting export restriction produces a contextual agenda instead of the same toggle briefing', () => {
  let state = advanceTurn(createGame('lumen', quiet), 'embargo');
  state = advanceTurn(state, 'maintain');
  state.countries.lumen.food = 55;
  state.countries.lumen.price = 130;
  const scenario = getScenario(state);
  assert.equal(scenario.agenda.family, 'subsidy');
  assert.equal(scenario.options.length, 3);
  assert.deepEqual(scenario.options.map(option => option.id), [...currentAgenda(state).options.map(option => option.id), 'maintain']);
});

test('cabinet commands replay from lean state and legacy policies remain byte-for-byte compatible', () => {
  const state = ready('solis');
  const command = currentAgenda(state).options[1].id;
  const full = advanceTurn(state, command);
  const lean = advanceTurn({...state, history: state.history.slice(-4), commands: []}, command);
  const project = value => ({countries: value.countries, cabinetMemory: value.cabinetMemory, cabinetPlans: value.cabinetPlans});
  assert.deepEqual(project(lean), project(full));
  for (const legacy of ['maintain', 'ration', 'subsidy']) {
    const clean = ready('solis');
    const withUnusedFields = {...clean, cabinetMemory: {lastFamily: null, lastDecisionTurn: null, cooldowns: {}}, cabinetPlans: []};
    assert.deepEqual(advanceTurn(withUnusedFields, legacy).countries, advanceTurn(clean, legacy).countries);
  }
});

test('active plans and cooldowns force real variety while all offered orders remain executable', () => {
  let state = ready('cera');
  const families = new Set();
  for (let index = 0; index < 12; index += 1) {
    if (index === 2) state.countries.cera.treasury = 24;
    if (index === 5) { state.countries.cera.treasury = 65; state.countries.cera.price = 132; state.activePolicy = 'embargo'; }
    if (index === 8) { state.countries.cera.price = 100; state.activePolicy = 'open'; state.countries.cera.food = 78; }
    const agenda = currentAgenda(state);
    if (agenda) {
      families.add(agenda.family);
      const affordable = agenda.options.find(option => option.cost <= state.countries.cera.treasury && option.foodCost <= state.countries.cera.food);
      state = advanceTurn(state, affordable?.id ?? 'maintain');
    } else state = advanceTurn(state, 'maintain');
  }
  assert.ok(families.size >= 4, [...families].join(','));
});

test('all six campaigns replay cabinet decisions from commands and chronicle lean history', () => {
  for (const playerId of COUNTRY_IDS) {
    let state = ready(playerId);
    const command = currentAgenda(state).options[0].id;
    state = advanceTurn(state, command);
    state = advanceTurn(state, 'maintain');
    state = advanceTurn(state, 'maintain');
    let replay = createGame(playerId, quiet);
    for (const savedCommand of state.commands) replay = advanceTurn(replay, savedCommand);
    assert.deepEqual(replay, state);
    const chronicle = buildChronicle(state);
    assert.equal(chronicle.totalTurns, state.turn);
    assert.deepEqual(chronicle.points.at(-1).metrics, Object.fromEntries(['food', 'treasury', 'price', 'trust', 'approval'].map(metric => [metric, state.countries[playerId][metric]])));
  }
});

test('all six cabinet campaigns survive the real multi-slot save replay', () => {
  const previousStorage = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  try {
    const campaigns = new Map();
    for (const playerId of COUNTRY_IDS) {
      let state = advanceTurn(advanceTurn(createGame(playerId), 'maintain'), 'maintain');
      state = advanceTurn(state, currentAgenda(state).options[0].id);
      state = advanceTurn(state, 'maintain');
      assert.equal(saveGame(state, {phase: 'result', step: 0}), true);
      campaigns.set(playerId, state);
    }
    for (const [playerId, state] of campaigns) assert.deepEqual(loadGame(playerId).state, state);
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

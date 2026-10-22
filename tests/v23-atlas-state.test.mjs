import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTurn, createGame } from '../dist/engine.mjs';
import { COUNTRY_IDS } from '../dist/country-data.mjs';
import { countryAppearance } from '../dist/atlas-state.mjs';

test('V23 country appearance derives food and affordability bands for every nation without mutating state', () => {
  const state = createGame('lumen');
  const foods = [34, 35, 54, 55, 80, 22];
  const prices = [124, 125, 150, 90, 125, 100];
  COUNTRY_IDS.forEach((id, index) => Object.assign(state.countries[id], { food: foods[index], price: prices[index], infrastructure: index % 4 }));
  const before = structuredClone(state);

  const appearances = COUNTRY_IDS.map((id) => countryAppearance(state, id));

  assert.deepEqual(appearances.map(({ foodStatus }) => foodStatus), ['critical', 'strained', 'strained', 'secure', 'secure', 'critical']);
  assert.deepEqual(appearances.map(({ affordability }) => affordability), ['stable', 'pressure', 'pressure', 'stable', 'pressure', 'stable']);
  assert.deepEqual(appearances.map(({ facilityLevel }) => facilityLevel), [0, 1, 2, 3, 0, 1]);
  assert.ok(appearances.every(({ cues }) => cues.length === 2 && cues.every(Boolean)));
  assert.deepEqual(state, before);
});

test('V23 real facility investment lifecycle drives construction and completed levels for all six player countries', () => {
  for (const id of COUNTRY_IDS) {
    const started = advanceTurn(createGame(id), 'invest');
    const startedAppearance = countryAppearance(started, id, 'result');
    assert.equal(startedAppearance.development, 'started', `${id} should report the actual start record`);
    assert.equal(startedAppearance.construction, true, `${id} should show a scaffold while its project is active`);
    assert.equal(startedAppearance.facilityLevel, 0);
    const foreignId = COUNTRY_IDS.find((countryId) => countryId !== id);
    assert.equal(countryAppearance(started, foreignId).construction, false, `${foreignId} must not inherit ${id}'s project scaffold`);

    const building = advanceTurn(started, 'maintain');
    const buildingAppearance = countryAppearance(building, id, 'result');
    assert.equal(buildingAppearance.development, 'building', `${id} should report the ongoing project`);
    assert.equal(buildingAppearance.construction, true);
    assert.equal(buildingAppearance.facilityLevel, 0);

    const completed = advanceTurn(building, 'maintain');
    const completedAppearance = countryAppearance(completed, id, 'result');
    assert.equal(completedAppearance.development, 'completed', `${id} should report its real completion record`);
    assert.equal(completedAppearance.construction, false, `${id} scaffold must leave with the completed project`);
    assert.equal(completedAppearance.facilityLevel, 1);

    const operating = advanceTurn(completed, 'maintain');
    const operatingAppearance = countryAppearance(operating, id, 'result');
    assert.equal(operatingAppearance.development, null);
    assert.equal(operatingAppearance.construction, false);
    assert.equal(operatingAppearance.facilityLevel, 1);
  }
});

test('V23 appearance rejects unknown countries instead of inventing a scene state', () => {
  assert.equal(countryAppearance(createGame('lumen'), 'unknown'), null);
});

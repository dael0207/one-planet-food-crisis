import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceTurn, createGame } from '../dist/engine.mjs';
import { COUNTRY_IDS } from '../dist/country-data.mjs';
import { MAP_LANDMARKS, mapCountryResult, renderCountryIntel, renderMapBrief } from '../dist/room-map-ui.mjs';

test('fixed geography gives every country contours and a settlement plus role-specific terrain', () => {
  // Given: the fixed six-country atlas configuration.
  const landmarks = COUNTRY_IDS.map((id) => MAP_LANDMARKS[id]);

  // When: its geographic feature coverage is inspected.
  const specialized = landmarks.filter((marks) => marks.farms?.length || marks.hills?.length || marks.coast);

  // Then: every land has base geography and every land has a material specialized feature.
  assert.ok(landmarks.every((marks) => marks.contours.length >= 2 && marks.settlement.length === 2));
  assert.equal(specialized.length, COUNTRY_IDS.length);
});

test('country inspection reports live national facts and the actual bilateral relation', () => {
  // Given: a completed quarter and a foreign country selected for inspection.
  const state = advanceTurn(createGame('lumen'), 'balanced');
  state.countries.nord.infrastructure = 2;

  // When: the inspection rail is rendered.
  const html = renderCountryIntel(state, 'nord', 'result');

  // Then: machine-readable facts match state and controls remain non-mutating.
  assert.match(html, /data-country-intel="nord"/);
  assert.match(html, new RegExp(`data-relation="${state.relations['lumen:nord']}"`));
  assert.match(html, new RegExp(`data-food="${state.countries.nord.food}"`));
  assert.match(html, new RegExp(`data-treasury="${state.countries.nord.treasury}"`));
  assert.match(html, new RegExp(`data-price="${state.countries.nord.price}"`));
  assert.match(html, /결과 확인 중/);
  assert.doesNotMatch(html, /data-action="open-(proposal|treaty)"/);
  assert.doesNotMatch(html, /기본 생산/);
  assert.doesNotMatch(html, /data-action="execute"/);
});

test('own-country inspection exposes the real project deadline and close action', () => {
  // Given: a facility investment has started.
  const state = advanceTurn(createGame('cera'), 'invest');

  // When: the governed country is inspected.
  const html = renderCountryIntel(state, 'cera', 'result');

  // Then: the current project is derived from the live project record.
  assert.match(html, new RegExp(`data-project-due="${state.projects[0].dueTurn}"`));
  assert.match(html, /data-action="close-country-inspect"/);
  assert.doesNotMatch(html, /data-action="diplomacy"/);
});

test('result map brief separates total food movement from direct policy comparison', () => {
  // Given: a result with recorded country changes and a same-world comparison.
  const state = advanceTurn(createGame('lumen'), 'balanced');
  const record = state.history.at(-1);
  const expectedTotal = state.countries.lumen.food - record.beforeCountries.lumen.food;

  // When: the map brief is rendered for the result phase.
  const html = renderMapBrief(state, 'result');

  // Then: the player total and direct comparison are distinct structured values.
  assert.match(html, new RegExp(`data-country="lumen"[^>]*data-total-food="${expectedTotal}"`));
  assert.match(html, new RegExp(`data-direct-food="${record.policyEffect.food}"`));
  for (const change of record.changes.filter((item) => item.metric === 'food')) {
    assert.match(html, new RegExp(`data-country="${change.countryId}"[^>]*data-total-food="${change.after - change.before}"`));
  }
});

test('decision map brief has no result deltas', () => {
  // Given: a fresh campaign before any quarter has run.
  const state = createGame('solis');

  // When: the decision brief is rendered.
  const html = renderMapBrief(state, 'decision');

  // Then: it identifies the phase without fabricating result effects.
  assert.match(html, /data-map-brief-phase="decision"/);
  assert.doesNotMatch(html, /data-total-food=/);
});

test('map country result exposes only recorded result deltas and construction milestones', () => {
  // Given: a quarter that starts a facility project.
  const state = advanceTurn(createGame('altia'), 'invest');
  const record = state.history.at(-1);

  // When: map facts are derived for result and decision phases.
  const result = mapCountryResult(state, 'altia', 'result');
  const decision = mapCountryResult(state, 'altia', 'decision');

  // Then: result facts use the engine record while decision facts omit stale deltas.
  assert.equal(result.foodDelta, state.countries.altia.food - record.beforeCountries.altia.food);
  assert.equal(result.development, 'started');
  assert.equal(result.projectDueTurn, state.projects[0].dueTurn);
  assert.equal(decision.foodDelta, null);
  assert.equal(decision.development, null);
});

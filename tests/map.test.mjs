import test from 'node:test';
import assert from 'node:assert/strict';
import { mapRoutes, routeGeometry } from '../dist/map-geometry.mjs';
import { getWorldStatus } from '../dist/map.mjs';

test('map shows executed foreign transfers and omits invented or self routes', () => {
  const state = { turn: 1, activePolicy: 'open', history: [{ worldActions: [
    { countryId: 'cera', targetId: 'solis', type: 'aid' },
    { countryId: 'marin', targetId: 'altia', type: 'trade' },
    { countryId: 'altia', targetId: 'altia', type: 'investment' },
    { countryId: 'nord', targetId: 'unknown', type: 'trade' },
    { countryId: 'nord', targetId: 'lumen', type: 'request' },
  ] }] };
  const transfers = mapRoutes(state).filter((route) => route.liveAction);
  assert.deepEqual(transfers.map(({ countryId, targetId }) => [countryId, targetId]), [['cera', 'solis'], ['marin', 'altia']]);
});

test('executed transfers replace matching baseline routes', () => {
  const state = { turn: 2, activePolicy: 'open', history: [{ worldActions: [{ countryId: 'lumen', targetId: 'nord', type: 'trade' }] }] };
  const matching = mapRoutes(state).filter((route) => route.countryId === 'lumen' && route.targetId === 'nord');
  assert.equal(matching.length, 1);
  assert.equal(matching[0].liveAction, true);
});

test('embargo marks domestic routes without closing independent foreign trade', () => {
  const routes = mapRoutes({ playerId: 'lumen', turn: 3, activePolicy: 'embargo', history: [{ worldActions: [{ countryId: 'cera', targetId: 'nord', type: 'trade' }] }] });
  assert.equal(routes.filter((route) => route.blocked).length, 3);
  assert.equal(routes.find((route) => route.countryId === 'cera').blocked, undefined);
});

test('a Cera restriction does not close Lumen base exports', () => {
  const routes = mapRoutes({ playerId: 'cera', turn: 3, activePolicy: 'embargo', history: [] });
  assert.equal(routes.filter((route) => route.countryId === 'lumen').length, 3);
  assert.equal(routes.some((route) => route.blocked), false);
});

test('map removes agreement routes at their exclusive end turn', () => {
  const state = { playerId: 'nord', turn: 4, agreements: [{ fromId: 'altia', type: 'technology', startTurn: 2, endTurn: 4 }, { fromId: 'cera', type: 'trade', startTurn: 3, endTurn: 6 }] };
  const agreements = mapRoutes(state).filter((route) => route.type === 'agreement');
  assert.deepEqual(agreements.map((route) => route.countryId), ['cera']);
  assert.equal(agreements[0].targetId, 'nord');
  assert.equal(routeGeometry('unknown', 'cera'), null);
  assert.equal(routeGeometry('cera', 'cera'), null);
  assert.ok(routeGeometry('cera', 'solis').d.startsWith('M'));
});

test('world status counts only actions by countries other than the selected player', () => {
  const state = { playerId: 'cera', turn: 1, activePolicy: 'open', requests: [], history: [{ worldActions: [
    { countryId: 'cera', targetId: 'nord', type: 'trade' },
    { countryId: 'lumen', targetId: 'solis', type: 'aid' },
  ] }] };
  assert.match(getWorldStatus(state), /타국 행동 1건/);
});

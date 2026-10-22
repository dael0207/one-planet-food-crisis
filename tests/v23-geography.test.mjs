import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTINENT_PATH, GEOGRAPHY, NATIONAL_BORDERS, routeGeometry } from '../dist/map-geometry.mjs';

const IDS = ['lumen', 'nord', 'cera', 'altia', 'marin', 'solis'];
const ANCHORS = {
  lumen: [180, 250], nord: [470, 145], cera: [720, 250],
  altia: [190, 475], marin: [475, 440], solis: [740, 475],
};

const points = (path, offset = [0, 0]) => {
  const values = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number);
  return Array.from({ length: values.length / 2 }, (_unused, index) => [
    values[index * 2] + offset[0], values[index * 2 + 1] + offset[1],
  ]);
};

const containsSequence = (haystack, needle) => {
  const encodedHaystack = haystack.map((point) => point.join(',')).join('|');
  const forward = needle.map((point) => point.join(',')).join('|');
  const reverse = [...needle].reverse().map((point) => point.join(',')).join('|');
  return encodedHaystack.includes(forward) || encodedHaystack.includes(reverse);
};

const cubicSegments = (path, offset = [0, 0]) => {
  const pathPoints = points(path, offset);
  return Array.from({ length: (pathPoints.length - 1) / 3 }, (_unused, index) => pathPoints.slice(index * 3, index * 3 + 4));
};

const segmentKey = (segment) => segment.map((point) => point.join(',')).join('|');

const containsPoint = (path, offset, point) => {
  const polygon = [points(path, offset)[0]];
  for (const [start, firstControl, secondControl, end] of cubicSegments(path, offset)) {
    for (let step = 1; step <= 16; step += 1) {
      const t = step / 16;
      const inverse = 1 - t;
      polygon.push([0, 1].map((axis) => inverse ** 3 * start[axis]
        + 3 * inverse ** 2 * t * firstControl[axis]
        + 3 * inverse * t ** 2 * secondControl[axis]
        + t ** 3 * end[axis]));
    }
  }
  return polygon.reduce((inside, current, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const crosses = (current[1] > point[1]) !== (previous[1] > point[1])
      && point[0] < (previous[0] - current[0]) * (point[1] - current[1]) / (previous[1] - current[1]) + current[0];
    return crosses ? !inside : inside;
  }, false);
};

test('V23 defines one bounded continental shoreline with six fixed operational anchors', () => {
  const shoreline = points(CONTINENT_PATH);
  const xs = shoreline.map(([x]) => x);
  const ys = shoreline.map(([, y]) => y);

  assert.match(CONTINENT_PATH, /^M.*(?:C.*){8,}Z$/);
  assert.ok(Math.min(...xs) >= 40 && Math.max(...xs) <= 860);
  assert.ok(Math.min(...ys) >= 40 && Math.max(...ys) <= 590);
  assert.ok(Math.min(...ys) >= 48, 'the continent must leave room for the atlas header');
  for (const id of IDS) {
    assert.deepEqual([GEOGRAPHY[id].x, GEOGRAPHY[id].y], ANCHORS[id]);
    assert.match(GEOGRAPHY[id].land, /^M.*C.*Z$/);
    assert.ok(routeGeometry('lumen', id) || id === 'lumen');
    const [portX, portY] = GEOGRAPHY[id].port;
    assert.ok(points(CONTINENT_PATH).some(([x, y]) => x === portX + GEOGRAPHY[id].x && y === portY + GEOGRAPHY[id].y), `${id} port must sit on the continental coast`);
    assert.ok(containsPoint(GEOGRAPHY[id].land, ANCHORS[id], ANCHORS[id]), `${id} route anchor must remain inside its territory`);
  }
});

test('V23 every continental shoreline segment belongs to exactly one coastal territory', () => {
  const territorySegments = IDS.flatMap((id) => cubicSegments(GEOGRAPHY[id].land, ANCHORS[id]));
  for (const shorelineSegment of cubicSegments(CONTINENT_PATH)) {
    const forward = segmentKey(shorelineSegment);
    const reverse = segmentKey([...shorelineSegment].reverse());
    const owners = territorySegments.filter((segment) => segmentKey(segment) === forward || segmentKey(segment) === reverse);
    assert.equal(owners.length, 1, `shoreline segment ${forward} must have one territory owner`);
  }
});

test('V23 national borders are single-authored shared frontiers in both adjacent territory paths', () => {
  const pairKeys = NATIONAL_BORDERS.map(({ countries }) => [...countries].sort().join(':'));
  assert.equal(NATIONAL_BORDERS.length, 9);
  assert.equal(new Set(pairKeys).size, NATIONAL_BORDERS.length);

  for (const border of NATIONAL_BORDERS) {
    assert.equal(border.countries.length, 2);
    assert.ok(border.countries.every((id) => IDS.includes(id)));
    assert.match(border.d, /^M.*C/);
    const frontier = points(border.d);
    for (const id of border.countries) {
      const territory = points(GEOGRAPHY[id].land, ANCHORS[id]);
      assert.ok(containsSequence(territory, frontier), `${id} does not stitch to ${pairKeys[NATIONAL_BORDERS.indexOf(border)]}`);
    }
  }
});

test('V23 territory adjacency forms one connected strategy-game continent', () => {
  const reached = new Set(['lumen']);
  while (true) {
    const next = NATIONAL_BORDERS.find(({ countries: [a, b] }) => reached.has(a) !== reached.has(b));
    if (!next) break;
    reached.add(next.countries[0]);
    reached.add(next.countries[1]);
  }
  assert.deepEqual([...reached].sort(), [...IDS].sort());
  for (const id of IDS) assert.ok(GEOGRAPHY[id].neighbors.length >= 2, `${id} needs strategic land neighbors`);
});

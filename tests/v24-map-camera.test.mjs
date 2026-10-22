import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

import {WORLD_VIEW, boundedCameraView, focusCameraView, panCameraView, zoomCameraView} from '../dist/map-camera.mjs';

test('camera zoom keeps the current center and uses only bounded strategy levels', () => {
  const zoomed = boundedCameraView({x: 450, y: 310}, 2.2);
  assert.deepEqual(zoomed, {x: 225, y: 155, width: 450, height: 310, zoom: 2});
  const medium = zoomCameraView(WORLD_VIEW, 1.5);
  assert.equal(medium.zoom, 1.5);
  assert.equal(medium.width, 600);
  assert.ok(Math.abs(medium.x + medium.width / 2 - 450) < Number.EPSILON * 450);
  assert.ok(Math.abs(medium.y + medium.height / 2 - 310) < Number.EPSILON * 310);
});

test('camera pan and focus clamp to the 900 by 620 world', () => {
  const view = focusCameraView({x: 20, y: 600}, 3);
  assert.deepEqual(view, {x: 0, y: 620 - 620 / 3, width: 300, height: 620 / 3, zoom: 3});
  assert.deepEqual(panCameraView(view, -999, 999), view);
  assert.deepEqual(panCameraView(view, 999, -999), {x: 600, y: 0, width: 300, height: 620 / 3, zoom: 3});
});

test('camera interaction has explicit pan mode, drag threshold and accessible native controls', async () => {
  const [source, css] = await Promise.all([
    readFile(new URL('../dist/map-camera.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../dist/map-camera.css', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /Math\.hypot\(dx, dy\) < 5/);
  assert.match(source, /button\('지도 이동 모드', 'pan-mode', '지도 이동'\)/);
  assert.match(source, /button\('전체 지도 보기', 'reset', '전체'\)/);
  assert.doesNotMatch(source, /wheel/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /\.map-camera-controls\s*\{[^}]*padding: 8px 12px/s);
  assert.match(css, /\.map-camera-pan-pad\s*\{[^}]*display: flex[^}]*height: 44px/s);
});

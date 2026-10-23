import {GEOGRAPHY} from './map-geometry.mjs?v=31';
import {SCENE_LAYOUT} from './atlas-state.mjs?v=31';

export const WORLD_VIEW = Object.freeze({x: 0, y: 0, width: 900, height: 620, zoom: 1});
export const CAMERA_ZOOMS = Object.freeze([1, 1.5, 2, 3]);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const centerOf = (view) => ({x: view.x + view.width / 2, y: view.y + view.height / 2});

export function boundedCameraView(center, zoom = 1) {
  const level = CAMERA_ZOOMS.includes(zoom) ? zoom : CAMERA_ZOOMS.reduce((best, item) => Math.abs(item - zoom) < Math.abs(best - zoom) ? item : best);
  const width = WORLD_VIEW.width / level;
  const height = WORLD_VIEW.height / level;
  return {
    x: clamp(center.x - width / 2, 0, WORLD_VIEW.width - width),
    y: clamp(center.y - height / 2, 0, WORLD_VIEW.height - height),
    width, height, zoom: level,
  };
}

export function zoomCameraView(view, zoom) {
  return boundedCameraView(centerOf(view), zoom);
}

export function panCameraView(view, dx, dy) {
  return {
    ...view,
    x: clamp(view.x + dx, 0, WORLD_VIEW.width - view.width),
    y: clamp(view.y + dy, 0, WORLD_VIEW.height - view.height),
  };
}

export function focusCameraView(point, zoom = 2) {
  return boundedCameraView(point, zoom);
}

function cameraSitePoint(countryId, kind) {
  const geography = GEOGRAPHY[countryId];
  if (!geography) return null;
  const local = kind === 'port' ? geography.port : SCENE_LAYOUT[countryId]?.[kind === 'city' ? 'town' : kind];
  return local ? {x: geography.x + local[0], y: geography.y + local[1]} : null;
}

function button(label, action, text) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'map-camera-button';
  element.dataset.cameraAction = action;
  element.setAttribute('aria-label', label);
  element.textContent = text;
  return element;
}

function mountControls(controls) {
  if (!controls) return {};
  controls.classList.add('map-camera-controls');
  controls.setAttribute('aria-label', '지도 확대와 이동');
  const zoomOut = button('지도 축소', 'zoom-out', '−');
  const scale = document.createElement('output');
  scale.className = 'map-camera-scale';
  scale.setAttribute('aria-live', 'polite');
  const zoomIn = button('지도 확대', 'zoom-in', '+');
  const reset = button('전체 지도 보기', 'reset', '전체');
  const panMode = button('지도 이동 모드', 'pan-mode', '지도 이동');
  panMode.setAttribute('aria-pressed', 'false');
  const pad = document.createElement('div');
  pad.className = 'map-camera-pan-pad';
  pad.setAttribute('aria-label', '지도 이동 방향');
  pad.append(button('지도를 위로 이동', 'pan-up', '↑'), button('지도를 왼쪽으로 이동', 'pan-left', '←'), button('지도를 아래로 이동', 'pan-down', '↓'), button('지도를 오른쪽으로 이동', 'pan-right', '→'));
  controls.replaceChildren(zoomOut, scale, zoomIn, reset, panMode, pad);
  return {zoomOut, scale, zoomIn, reset, panMode, pad};
}

export function createMapCamera(svg, controls) {
  if (!svg) throw new TypeError('createMapCamera requires an SVG element');
  const ui = mountControls(controls);
  svg.setAttribute('tabindex', '0');
  svg.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight + - 0');
  let view = {...WORLD_VIEW};
  let panMode = false;
  let drag = null;

  const apply = () => {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
    svg.setAttribute('data-camera-zoom', String(view.zoom));
    svg.setAttribute('data-camera-pan', String(panMode));
    if (ui.scale) ui.scale.textContent = `${view.zoom}×`;
    if (ui.zoomOut) ui.zoomOut.disabled = view.zoom === CAMERA_ZOOMS[0];
    if (ui.zoomIn) ui.zoomIn.disabled = view.zoom === CAMERA_ZOOMS.at(-1);
    if (ui.panMode) ui.panMode.setAttribute('aria-pressed', String(panMode));
    return {...view};
  };

  const setZoom = (direction) => {
    const index = CAMERA_ZOOMS.indexOf(view.zoom);
    const next = CAMERA_ZOOMS[clamp(index + direction, 0, CAMERA_ZOOMS.length - 1)];
    view = zoomCameraView(view, next);
    return apply();
  };
  const move = (x, y) => {
    view = panCameraView(view, view.width * x * .18, view.height * y * .18);
    return apply();
  };
  const reset = () => { view = {...WORLD_VIEW}; panMode = false; return apply(); };
  const focusCountry = (countryId) => {
    const point = GEOGRAPHY[countryId];
    if (point) view = focusCameraView(point, 1.5);
    return apply();
  };
  const focusSite = ({countryId, kind} = {}) => {
    const point = cameraSitePoint(countryId, kind);
    if (point) { view = focusCameraView(point, 3); panMode = false; }
    return apply();
  };

  controls?.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-camera-action]')?.dataset.cameraAction;
    if (action === 'zoom-in') setZoom(1);
    if (action === 'zoom-out') setZoom(-1);
    if (action === 'reset') reset();
    if (action === 'pan-mode') { panMode = !panMode; apply(); }
    if (action === 'pan-up') move(0, -1);
    if (action === 'pan-down') move(0, 1);
    if (action === 'pan-left') move(-1, 0);
    if (action === 'pan-right') move(1, 0);
  });

  svg.addEventListener('keydown', (event) => {
    if (event.target !== svg) return;
    const directions = {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
    if (directions[event.key] && view.zoom > 1) { event.preventDefault(); move(...directions[event.key]); }
    if (['+','=', '-', '0'].includes(event.key)) { event.preventDefault(); if(event.key==='0')reset();else setZoom(event.key==='-'?-1:1); }
  });

  svg.addEventListener('pointerdown', (event) => {
    if (!panMode || event.button !== 0) return;
    event.preventDefault();
    drag = {pointerId: event.pointerId, x: event.clientX, y: event.clientY, view: {...view}, moved: false};
    svg.setPointerCapture?.(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    const rect = svg.getBoundingClientRect();
    view = panCameraView(drag.view, -dx * drag.view.width / Math.max(rect.width, 1), -dy * drag.view.height / Math.max(rect.height, 1));
    svg.classList.add('is-camera-dragging');
    apply();
  });
  const finishDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    svg.releasePointerCapture?.(event.pointerId);
    drag = null;
    svg.classList.remove('is-camera-dragging');
  };
  svg.addEventListener('pointerup', finishDrag);
  svg.addEventListener('pointercancel', finishDrag);
  svg.addEventListener('click', (event) => {
    if (!panMode) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  apply();
  return {
    zoomIn: () => setZoom(1),
    zoomOut: () => setZoom(-1),
    reset,
    focusCountry,
    focusSite,
    update: apply,
    get view() { return {...view}; },
  };
}

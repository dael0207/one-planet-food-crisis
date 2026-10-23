export const FARM_LANDSCAPE_ASSETS = Object.freeze({
  healthy: 'farm-healthy-v30.webp',
  drought: 'farm-drought-v30.webp',
  recovering: 'farm-recovering-v30.webp',
  expansion: 'farm-expansion-v30.webp',
});

const FARM_INSETS = Object.freeze({
  lumen: 'translate(4 -8)', nord: 'translate(-4 4)', cera: 'translate(-6 -8)',
  altia: 'translate(0 6)', marin: 'translate(6 -12)', solis: 'translate(0 -4)',
});
const FARM_PHASES = Object.freeze(['healthy', 'drought', 'recovering']);

const path = (node, className, d, tier = null) => node('path', {
  class: className,
  d,
  ...(tier === null ? {} : {'data-farm-tier': tier}),
});

export function buildFarmScene(node, countryId) {
  const scene = node('g', {
    class: 'farm-landscape',
    'data-country': countryId,
    'aria-hidden': 'true',
  });
  const material = node('g', {class: 'farm-landscape-material', transform: FARM_INSETS[countryId] ?? ''});
  material.append(node('image', {
    class: 'farm-landscape-base',
    href: FARM_LANDSCAPE_ASSETS.healthy,
    x: -50,
    y: -36,
    width: 100,
    height: 72,
    preserveAspectRatio: 'xMidYMid meet',
  }));
  material.append(
    node('image', {
      class: 'farm-recovery-layer',
      href: FARM_LANDSCAPE_ASSETS.healthy,
      x: -50,
      y: -36,
      width: 100,
      height: 72,
      preserveAspectRatio: 'xMidYMid meet',
    }),
    node('image', {
      class: 'farm-growth farm-expansion',
      href: FARM_LANDSCAPE_ASSETS.expansion,
      x: -62,
      y: -4,
      width: 62,
      height: 45,
      preserveAspectRatio: 'xMidYMid meet',
      'data-farm-tier': 1,
    }),
    node('image', {
      class: 'farm-growth farm-expansion',
      href: FARM_LANDSCAPE_ASSETS.expansion,
      x: 2,
      y: -43,
      width: 66,
      height: 48,
      preserveAspectRatio: 'xMidYMid meet',
      'data-farm-tier': 2,
    }),
    node('image', {
      class: 'farm-growth farm-expansion',
      href: FARM_LANDSCAPE_ASSETS.expansion,
      x: 19,
      y: 1,
      width: 48,
      height: 35,
      preserveAspectRatio: 'xMidYMid meet',
      'data-farm-tier': 3,
    }),
    path(node, 'farm-growth farm-parcel', 'M-48 9C-36 3-24 4-13 10L-18 24C-29 27-42 24-52 18Z', 1),
    path(node, 'farm-growth farm-irrigation', 'M-43 15C-31 12-22 14-15 19M-38 20C-30 18-24 19-18 22', 1),
    path(node, 'farm-growth farm-parcel', 'M15-25C27-27 42-23 52-16L47-5C35-8 24-6 13-10Z', 2),
    path(node, 'farm-growth farm-service-path', 'M-47 5C-24-5-9-1 8-9S36-18 49-10', 2),
    path(node, 'farm-growth farm-parcel', 'M35 7C47 5 58 10 64 19L53 30C43 27 34 22 27 15Z', 3),
    path(node, 'farm-climate-scar', 'M-39-8C-30-4-23-6-16 0', 1),
    path(node, 'farm-climate-scar', 'M7-25C14-15 12-7 21 1', 2),
    path(node, 'farm-climate-scar', 'M27 12C37 7 48 12 55 21', 3),
  );
  const planned = node('g', {class: 'farm-planned-works', 'aria-hidden': 'true'});
  planned.append(
    path(node, 'farm-soil-scar', 'M-39 10C-27 4-11 7 1 14L-5 27C-19 29-33 25-43 18Z'),
    path(node, 'farm-survey-line', 'M-34 20C-17 15-2 20 16 13S40 4 51 10'),
  );
  material.append(planned);
  scene.append(material);
  return scene;
}

export function updateFarmScene(target, landscape) {
  if (!target || !landscape) return target;
  const phase = FARM_PHASES.includes(landscape.phase) ? landscape.phase : 'healthy';
  const infrastructure = landscape.infrastructure ?? {};
  const level = Number.isInteger(infrastructure.siteLevel) ? Math.max(0, Math.min(3, infrastructure.siteLevel)) : 'unknown';
  const building = Boolean(infrastructure.siteProject) && ['started', 'building', 'construction'].includes(infrastructure.stage);
  const plannedLevel = Number.isInteger(infrastructure.siteProject?.level)
    ? Math.max(0, Math.min(3, infrastructure.siteProject.level))
    : level;
  target.setAttribute('data-farm-phase', phase);
  target.setAttribute('data-farm-severity', String(landscape.severity ?? 0));
  target.setAttribute('data-recovery-elapsed', String(landscape.recoveryElapsed ?? 0));
  target.setAttribute('data-farm-level', String(level));
  target.setAttribute('data-farm-building', String(building));
  target.setAttribute('data-planned-level', String(plannedLevel));
  target.setAttribute('data-farm-irrigated', String(infrastructure.irrigated === true));
  target.setAttribute('data-farm-expanded', String(infrastructure.expanded === true));
  const base = target.querySelector('.farm-landscape-base');
  if (base) base.setAttribute('href', FARM_LANDSCAPE_ASSETS[phase]);
  return target;
}

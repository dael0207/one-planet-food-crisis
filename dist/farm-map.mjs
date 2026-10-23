export const FARM_LANDSCAPE_ASSETS = Object.freeze({
  healthy: 'farm-healthy-v35.webp',
  drought: 'farm-drought-v35.webp',
  recovering: 'farm-recovering-v35.webp',
  expansion: 'farm-healthy-v35.webp',
});

const FARM_MATERIAL_TRANSFORMS = Object.freeze({
  lumen: 'translate(4 -8)',
  nord: 'translate(-4 4) rotate(6) scale(.9 .92)',
  cera: 'translate(-6 -8) rotate(3) scale(1.07 .88)',
  altia: 'translate(0 6) rotate(-5) scale(-.9 .82)',
  marin: 'translate(6 -12) rotate(-7) scale(.86 1.04)',
  solis: 'translate(0 -4) rotate(7) scale(-.94 .9)',
});
const FARM_DISTRICTS = Object.freeze({
  lumen: 'M-46-19C-27-32-13-23 2-30L21-24L39-10L34 9L46 20L24 32L4 26L-19 34L-39 20L-47 3Z',
  nord: 'M-44-20L-18-28L2-30L21-24L39-10L34 9L46 20L24 32L4 26L-19 34L-39 20L-47 3Z',
  cera: 'M-46-19L-22-32L2-30L21-24L39-10L34 9L46 20L24 32L4 26L-19 34L-39 20L-47 3Z',
  altia: 'M-46-19L-26-26L2-30L21-24L39-10L34 9L46 20L24 32L4 26L-19 34L-39 20L-47 3Z',
  marin: 'M-46-19L-20-31L2-30L21-24L39-10L34 9L46 20L24 32L4 26L-19 34L-39 20L-47 3Z',
  solis: 'M-46-19L-25-34L2-30L21-24L39-10L34 9L46 20L24 32L4 26L-19 34L-39 20L-47 3Z',
});
const EXPANSION_PARCELS = Object.freeze([
  'M-47 3L-39 20L-19 34L-35 42L-59 29L-61 13Z',
  'M2-30L21-24L39-10L56-19L45-39L24-43Z',
  'M34 9L46 20L24 32L37 43L65 28L60 7Z',
]);
const FARM_PHASES = Object.freeze(['healthy', 'drought', 'recovering']);
const IRRIGATION_COUNTRIES = Object.freeze(['lumen', 'solis']);

const path = (node, className, d, tier = null) => node('path', {
  class: className,
  d,
  ...(tier === null ? {} : {'data-farm-tier': tier}),
});

function groundMasks(node, countryId) {
  const defs=node('defs'),filter=node('filter',{id:`farm-feather-${countryId}`,x:'-15%',y:'-15%',width:'130%',height:'130%'});
  filter.append(node('feGaussianBlur',{stdDeviation:1.4}));defs.append(filter);
  const main=FARM_DISTRICTS[countryId];
  [main,...EXPANSION_PARCELS].forEach((d,index)=>{
    const mask=node('mask',{id:`farm-ground-${countryId}-${index}`,maskUnits:'userSpaceOnUse',x:-80,y:-64,width:160,height:128});
    mask.append(node('path',{d,fill:'white',filter:`url(#farm-feather-${countryId})`}));defs.append(mask);
  });
  return defs;
}

const groundImage=(node,className,href,countryId,index,tier=null)=>node('image',{
  class:className,href,x:-72,y:-56,width:144,height:112,
  mask:`url(#farm-ground-${countryId}-${index})`,preserveAspectRatio:'xMidYMid slice',
  ...(tier===null?{}:{'data-farm-tier':tier}),
});

export function buildFarmScene(node, countryId) {
  if(!Object.hasOwn(FARM_DISTRICTS,countryId))return null;
  const scene = node('g', {
    class: 'farm-landscape',
    'data-country': countryId,
    'aria-hidden': 'true',
  });
  const material = node('g', {class: 'farm-landscape-material', transform: FARM_MATERIAL_TRANSFORMS[countryId] ?? ''});
  material.append(groundMasks(node,countryId),groundImage(node,'farm-landscape-base',FARM_LANDSCAPE_ASSETS.healthy,countryId,0));
  const expansion = node('g', {class: 'farm-expansion-cluster', transform: ''});
  EXPANSION_PARCELS.forEach((_d,index)=>expansion.append(groundImage(node,'farm-growth farm-expansion',FARM_LANDSCAPE_ASSETS.healthy,countryId,index+1,index+1)));
  material.append(
    groundImage(node,'farm-recovery-layer',FARM_LANDSCAPE_ASSETS.healthy,countryId,0),
    expansion,
    path(node, 'farm-growth farm-parcel', EXPANSION_PARCELS[0], 1),
    path(node, 'farm-growth farm-irrigation', 'M-43 15C-31 12-22 14-15 19M-38 20C-30 18-24 19-18 22', 1),
    path(node, 'farm-growth farm-parcel', EXPANSION_PARCELS[1], 2),
    path(node, 'farm-growth farm-service-path', 'M-47 5C-24-5-9-1 8-9S36-18 49-10', 2),
    path(node, 'farm-growth farm-parcel', EXPANSION_PARCELS[2], 3),
    path(node, 'farm-climate-scar', 'M-39-8C-30-4-23-6-16 0', 1),
    path(node, 'farm-climate-scar', 'M7-25C14-15 12-7 21 1', 2),
    path(node, 'farm-climate-scar', 'M27 12C37 7 48 12 55 21', 3),
    node('path', {class: 'farm-national-channel', d: 'M-49-20C-33-15-22-20-7-14S18-4 28-9', 'data-national-tier': 1}),
    node('path', {class: 'farm-national-channel', d: 'M-28 30C-12 23 2 27 15 20S38 8 50 13', 'data-national-tier': 2}),
    node('path', {class: 'farm-national-channel', d: 'M-56 3C-39-2-27 3-12-3S18-19 37-17', 'data-national-tier': 3}),
  );
  const planned = node('g', {class: 'farm-planned-works', 'aria-hidden': 'true'});
  planned.append(
    path(node, 'farm-soil-scar', 'M-39 10C-27 4-11 7 1 14L-5 27C-19 29-33 25-43 18Z'),
    path(node, 'farm-survey-line', 'M-34 20C-17 15-2 20 16 13S40 4 51 10'),
  );
  material.append(planned);
  const nationalProject = node('g', {class: 'farm-national-project', 'aria-hidden': 'true'});
  nationalProject.append(
    path(node, 'farm-national-trench', 'M-51-17C-35-12-23-17-8-11S18-1 31-7'),
    path(node, 'farm-national-trench-edge', 'M-50-14C-34-9-22-14-7-8S19 2 32-4'),
  );
  material.append(nationalProject);
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
  const irrigationCountry = IRRIGATION_COUNTRIES.includes(landscape.countryId);
  const nationalLevel = irrigationCountry && Number.isInteger(infrastructure.nationalLevel)
    ? Math.max(0, Math.min(3, infrastructure.nationalLevel))
    : 0;
  const nationalBuilding = irrigationCountry && Boolean(infrastructure.nationalProject);
  target.setAttribute('data-farm-phase', phase);
  target.setAttribute('data-farm-severity', String(landscape.severity ?? 0));
  target.setAttribute('data-recovery-elapsed', String(landscape.recoveryElapsed ?? 0));
  target.setAttribute('data-farm-level', String(level));
  target.setAttribute('data-farm-building', String(building));
  target.setAttribute('data-planned-level', String(plannedLevel));
  target.setAttribute('data-farm-irrigated', String(infrastructure.irrigated === true));
  target.setAttribute('data-farm-expanded', String(infrastructure.expanded === true));
  target.setAttribute('data-national-farm-level', String(nationalLevel));
  target.setAttribute('data-national-irrigation-building', String(nationalBuilding));
  const base = target.querySelector('.farm-landscape-base');
  if (base) base.setAttribute('href', FARM_LANDSCAPE_ASSETS[phase]);
  for(const image of target.querySelector('.farm-expansion-cluster')?.children??[])image.setAttribute('href',FARM_LANDSCAPE_ASSETS[phase]);
  return target;
}

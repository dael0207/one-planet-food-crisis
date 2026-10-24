import {buildDevelopment,DEVELOPMENT} from './map-development.mjs';

export const MAP_SITE_ASSETS = Object.freeze({
  city: 'map-city-v36.webp',
  port: 'map-port-v36.webp',
  farm: 'farm-healthy-v35.webp',
});

export const PORT_ROTATIONS = Object.freeze({lumen: 131, nord: 153, cera: -68, altia: 15, marin: 11, solis: -62});

const FRAME = Object.freeze({
  city: DEVELOPMENT.city.frame,
  port: DEVELOPMENT.port.frame,
  farm: {x: -40, y: -30, width: 80, height: 60},
});

const path = (node, className, d, tier = null) => node('path', {
  class: className,
  d,
  ...(tier === null ? {} : {'data-site-tier': tier}),
});

function addOperationalDetails(scene,node) {
  scene.append(
    path(node,'map-site-detail map-site-irrigation','M-30 7C-15 1 2 3 27-6',1),
    path(node,'map-site-detail map-site-field-edge','M-27-13 30-5M-24 15 31 7',2),
    path(node,'map-site-detail map-site-service-light','M19-12h4m-2-2v4',3),
  );
}
export function buildMapSiteScene(node, kind, countryId = null) {
  const frame = FRAME[kind];
  if (!frame || !MAP_SITE_ASSETS[kind]) return null;
  const rotation = kind === 'port' ? PORT_ROTATIONS[countryId] ?? 0 : 0;
  const scene = node('g', {
    class: `map-site-scene is-${kind}`,
    'data-site-scene': kind,
    'data-grounded': 'true',
    'data-coast-rotation': rotation,
    'aria-hidden': 'true',
  });
  const material = node('g', {class: 'map-site-material', transform: `rotate(${rotation})`});
  if(kind==='city'||kind==='port') material.append(buildDevelopment(node,kind,countryId));
  else {
    material.append(node('image',{class:'map-site-raster',href:MAP_SITE_ASSETS[kind],...frame,preserveAspectRatio:'xMidYMid meet'}));
    addOperationalDetails(material,node);
  }
  if (kind === 'city') {
    material.append(
      path(node, 'map-national-detail map-national-storage', 'M-31-5h7v9h-7Zm1-3h5v3h-5Z', 1),
      path(node, 'map-national-detail map-national-road', 'M-33 19C-17 16-7 20 8 17', 2),
      path(node, 'map-national-detail map-national-yard', 'M21 7h10v8H21Zm2-3h6v3h-6Z', 3),
    );
  }
  const worksite = node('g', {class: 'map-site-worksite'});
  worksite.append(
    path(node, 'map-site-workyard', 'M-14 10h26v11h-26Zm4 0V6h9v4'),
    path(node, 'map-site-workcrane', 'M5 10V-9h12M8-9v5M17-9 8-4'),
  );
  material.append(worksite);
  scene.append(material);
  return scene;
}

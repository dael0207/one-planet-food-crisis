export const MAP_SITE_ASSETS = Object.freeze({
  city: 'map-city-v34.webp',
  port: 'map-port-v34.webp',
  farm: 'farm-healthy-v34.webp',
});

export const PORT_ROTATIONS = Object.freeze({lumen: 180, nord: -90, cera: 0, altia: 90, marin: 90, solis: 0});

const FRAME = Object.freeze({
  city: {x: -39, y: -27, width: 78, height: 54},
  port: {x: -44, y: -22, width: 88, height: 44},
  farm: {x: -35, y: -28, width: 70, height: 56},
});

const path = (node, className, d, tier = null) => node('path', {
  class: className,
  d,
  ...(tier === null ? {} : {'data-site-tier': tier}),
});

function addOperationalDetails(scene, node, kind) {
  if (kind === 'city') {
    scene.append(
      path(node, 'map-site-detail map-site-streetlight', 'M-19 9h4m-2-2v4M13-7h4m-2-2v4', 1),
      path(node, 'map-site-detail map-site-road-extension', 'M-31 15C-17 12-6 17 6 13S24 8 33 12', 2),
      path(node, 'map-site-detail map-site-service-light', 'M-10-13h4m8 5h4m9 4h4', 3),
    );
    return;
  }
  if (kind === 'port') {
    scene.append(
      path(node, 'map-site-detail map-site-berth', 'M-25 13H4M-16 9v8M-4 9v8', 1),
      path(node, 'map-site-detail map-site-cargo', 'M8 10h8v5H8Zm10-2h7v5h-7Z', 2),
      path(node, 'map-site-detail map-site-vessel-track', 'M-3 22c11-3 22-3 33 0', 3),
    );
    return;
  }
  scene.append(
    path(node, 'map-site-detail map-site-irrigation', 'M-30 7C-15 1 2 3 27-6', 1),
    path(node, 'map-site-detail map-site-field-edge', 'M-27-13 30-5M-24 15 31 7', 2),
    path(node, 'map-site-detail map-site-service-light', 'M19-12h4m-2-2v4', 3),
  );
}

export function buildMapSiteScene(node, kind, countryId = null) {
  const frame = FRAME[kind];
  if (!frame || !MAP_SITE_ASSETS[kind]) return null;
  const rotation = kind === 'port' ? PORT_ROTATIONS[countryId] ?? 0 : 0;
  const scene = node('g', {class: `map-site-scene is-${kind}`, 'data-coast-rotation': rotation, 'aria-hidden': 'true'});
  const material = node('g', {class: 'map-site-material', transform: `rotate(${rotation})`});
  material.append(node('image', {
    class: 'map-site-raster', href: MAP_SITE_ASSETS[kind],
    ...frame, preserveAspectRatio: 'xMidYMid meet',
  }));
  addOperationalDetails(material, node, kind);
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

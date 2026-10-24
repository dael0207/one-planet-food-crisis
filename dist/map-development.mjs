// Registered ground artwork: every tier shares one frame, so existing streets stay put.
export const DEVELOPMENT = Object.freeze({
 city: {
  asset:'map-city-v36.webp',frame:{x:-48,y:-32,width:96,height:64},feather:1.2,
  bounds:[[-12,-10,24,20],[-24,-18,48,36],[-35,-24,70,48],[-46,-30,92,60]],
  outlines:[
   'M-12-7L-6-10H7L12-5V6L6 10H-8L-12 5Z',
   'M-24-9L-18-18H9L9-14H20L24-5V12L15 18H-13L-24 11Z',
   'M-35-12L-29-24H16L16-21H29L35-9V15L25 24H-22L-35 13Z',
   'M-46-18L-39-30H24L24-27H40L46-12V22L35 30H-31L-46 18Z',
  ],
 },
 port: {
  asset:'map-port-v36.webp',frame:{x:-36,y:-18,width:72,height:42},feather:.12,
  bounds:[[-8,-8,16,29],[-29,-12,37,33],[-29,-15,65,36],[-36,-18,72,42]],
  outlines:[
   'M-8-8H8V21H-8Z',
   'M-29-12H8V21H-29Z',
   'M-29-15H36V11H8V21H-29Z',
   'M-36-18H36V24H-36Z',
  ],
  worksites:[
   {land:'M-28-11H-10V0H-28Z',water:'M-28 0V14H-10V0'},
   {land:'M8-14H34V0H8Z',water:'M8 0V9H34V0'},
   {land:'M26-13H35V0H26Z',water:'M9 9V23H35V9'},
  ],
 },
});

export function buildDevelopment(node,kind,countryId) {
 const spec=DEVELOPMENT[kind];
 if(!spec)return null;
 const root=node('g',{class:'map-development','data-development-kind':kind,'data-development-level':'unknown','aria-hidden':'true'});
 const defs=node('defs'),prefix=`development-${kind}-${countryId??'preview'}`;
 const filter=node('filter',{id:`${prefix}-feather`,x:'-8%',y:'-8%',width:'116%',height:'116%'});
 filter.append(node('feGaussianBlur',{stdDeviation:spec.feather}));defs.append(filter);root.append(defs);
 for(let level=0;level<4;level++) {
  const id=`${prefix}-${level}`;
  const mask=node('mask',{id,maskUnits:'userSpaceOnUse',x:spec.frame.x-2,y:spec.frame.y-2,width:spec.frame.width+4,height:spec.frame.height+4});
  mask.append(node('path',{d:spec.outlines[level],fill:'white',filter:`url(#${prefix}-feather)`}));defs.append(mask);
  const region=node('g',{class:'map-development-region','data-tier':level,display:level===0?'inline':'none'});
  region.append(node('image',{class:'map-site-raster',href:spec.asset,...spec.frame,preserveAspectRatio:kind==='city'?'xMidYMid slice':'xMidYMid meet',mask:`url(#${id})`}));
  root.append(region);
 }
 for(let next=1;next<4;next++) {
  const work=node('g',{class:'map-development-workzone','data-next':next,display:'none'});
  const site=spec.worksites?.[next-1];
  work.append(node('path',{class:'map-development-earthworks',d:site?.land??`${spec.outlines[next]} ${spec.outlines[next-1]}`,'fill-rule':'evenodd'}));
  if(site)work.append(node('path',{class:'map-development-waterworks',d:site.water}));
  const [x,y]=spec.bounds[next];
  work.append(node('path',{class:'map-development-crane',d:`M${x+4} ${y+7}v-5h5m-3 0v2`}));
  root.append(work);
 }
 return root;
}

export function updateDevelopment(root,view) {
 if(!root)return;
 const known=Number.isInteger(view.level)&&view.level>=0&&view.level<=3;
 const completed=known?view.level:0;
 const pending=known&&completed<3&&Number.isInteger(view.remaining)&&view.remaining>0;
 root.setAttribute('data-development-level',known?String(completed):'unknown');
 for(const region of root.querySelectorAll('.map-development-region'))region.setAttribute('display',Number(region.getAttribute('data-tier'))===completed?'inline':'none');
 for(const work of root.querySelectorAll('.map-development-workzone'))work.setAttribute('display',pending&&Number(work.getAttribute('data-next'))===completed+1?'inline':'none');
}

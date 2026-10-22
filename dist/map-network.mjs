const COUNTRY_IDS=new Set(['lumen','nord','cera','altia','marin','solis']);
const CLOSED_STATUSES=new Set(['broken','cancelled','completed']);
const NEW_EVENTS=new Set(['accepted','formed']);

const list=value=>Array.isArray(value)?value:[];
const number=value=>Number.isFinite(value)?value:0;
const turnOf=state=>Number.isSafeInteger(state?.turn)?state.turn:0;
const validPair=(fromId,toId)=>COUNTRY_IDS.has(fromId)&&COUNTRY_IDS.has(toId)&&fromId!==toId;
const category=kind=>kind==='alliance'?'alliance':kind==='trade_buy'||kind==='trade_sell'?'trade':null;
const endTurnOf=record=>Number.isFinite(record?.endTurn)?record.endTurn:Number.isFinite(record?.startTurn)&&Number.isFinite(record?.duration)?record.startTurn+record.duration:null;

function currentEvents(state,record,source){
 const turn=turnOf(state),latest=source==='foreign'?state?.lastForeignEvents:state?.lastTreatyEvents;
 return [...list(latest),...list(record?.events)].filter(event=>event?.treatyId===record.id&&event.turn===turn);
}

function description(kind,food,money){
 if(kind==='alliance')return `위기 시 식량 ${food}${money?` · 지원금 ${money}`:''} 상호 지원`;
 return `분기당 식량 ${food} · 대금 ${money}`;
}

function treatyLink(state,record,source){
 if(!record||typeof record.id!=='string')return null;
 const kind=category(record.kind),playerId=record.playerId,targetId=record.targetId;
 if(!kind||!validPair(playerId,targetId)||record.status==='rejected')return null;
 const turn=turnOf(state),startTurn=Number.isFinite(record.startTurn)?record.startTurn:turn,endTurn=endTurnOf(record),events=currentEvents(state,record,source);
 if(!Number.isFinite(endTurn)||endTurn<=startTurn)return null;
 const closeEvent=events.find(event=>event.type===record.status);
 const newEvent=events.find(event=>NEW_EVENTS.has(event.type));
 const closed=CLOSED_STATUSES.has(record.status);
 if(closed&&!closeEvent&&record.resolvedTurn!==turn)return null;
 if(!closed&&(record.status!=='active'||turn>=endTurn))return null;
 const createdNow=Number.isFinite(record.createdTurn)?record.createdTurn===turn:source==='foreign'?startTurn-1===turn:startTurn===turn;
 const status=closed?record.status:newEvent||createdNow?'new':'active';
 const fromId=kind==='alliance'?[playerId,targetId].sort()[0]:record.kind==='trade_buy'?targetId:playerId;
 const toId=kind==='alliance'?[playerId,targetId].sort()[1]:record.kind==='trade_buy'?playerId:targetId;
 const food=number(record.food),money=number(record.money);
 const changedTurn=closeEvent?.turn??newEvent?.turn??(closed?record.resolvedTurn:createdNow?turn:undefined);
 return {id:record.id,fromId,toId,kind,status,source,food,money,remaining:closed?0:Math.max(0,endTurn-Math.max(startTurn,turn+1)),startsIn:closed?0:Math.max(0,startTurn-turn),description:description(kind,food,money),...(Number.isFinite(changedTurn)?{changedTurn}:{})};
}

function supplyLink(state,agreement){
 if(!agreement||typeof agreement.id!=='string'||agreement.type!=='trade'||!validPair(agreement.fromId,agreement.targetId))return null;
 const turn=turnOf(state),startTurn=Number.isFinite(agreement.startTurn)?agreement.startTurn:turn,endTurn=endTurnOf(agreement);
 if(!Number.isFinite(endTurn)||endTurn<=startTurn||turn>=endTurn)return null;
 const food=number(agreement.food),money=number(agreement.treasury),createdNow=Number.isFinite(agreement.createdTurn)?agreement.createdTurn===turn:startTurn===turn;
 return {id:agreement.id,fromId:agreement.fromId,toId:agreement.targetId,kind:'trade',status:createdNow?'new':'active',source:'supply',food,money,remaining:Math.max(0,endTurn-Math.max(startTurn,turn+1)),startsIn:Math.max(0,startTurn-turn),description:description('trade',food,money),...(createdNow?{changedTurn:turn}:{})};
}

const statusOrder={new:0,active:1,broken:2,cancelled:3,completed:4};
const compareLinks=(a,b)=>statusOrder[a.status]-statusOrder[b.status]||a.kind.localeCompare(b.kind)||a.fromId.localeCompare(b.fromId)||a.toId.localeCompare(b.toId)||a.id.localeCompare(b.id);

export function mapTreatyLinks(state,filter='all'){
 const actual=new Map();
 for(const record of list(state?.treaties))if(typeof record?.id==='string'&&!actual.has(record.id))actual.set(record.id,treatyLink(state,record,'player'));
 for(const record of [...list(state?.foreignTreaties),...list(state?.foreignTreatyHistory)])if(typeof record?.id==='string'&&!actual.has(record.id))actual.set(record.id,treatyLink(state,record,'foreign'));
 for(const record of list(state?.agreements))if(typeof record?.id==='string'&&!actual.has(record.id))actual.set(record.id,supplyLink(state,record));
 const kind=filter==='trade'||filter==='alliance'?filter:null;
 return [...actual.values()].filter(link=>link&&(!kind||link.kind===kind)).sort(compareLinks);
}

export function mapTreatyChanges(state){
 return mapTreatyLinks(state).filter(link=>link.status!=='active'&&link.changedTurn===turnOf(state));
}

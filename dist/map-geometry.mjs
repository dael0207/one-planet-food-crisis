import { GEOGRAPHY } from './continent-geometry.mjs?v=31';
export { CONTINENT_PATH, GEOGRAPHY, NATIONAL_BORDERS } from './continent-geometry.mjs?v=31';

const ACTION_LABELS = { trade: '교역', aid: '긴급 지원', peace_response_aid: '공동 대응 지원', investment: '시설 투자', invest: '시설 투자', technology: '기술 협력' };
const LUMEN_EXPORT_TARGETS = ['nord', 'marin', 'solis'];
const playerId = (state) => GEOGRAPHY[state?.playerId] ? state.playerId : 'lumen';
const routeKey = (fromId, toId) => `${fromId}:${toId}`;

export function mapRoutes(state) {
  const player = playerId(state);
  const liveRoutes = [];
  for (const record of state.history?.at(-1)?.worldActions ?? []) {
    if(record.source==='joint_investment'&&(!record.shipmentFromId||!record.shipmentToId||!(record.food>0)))continue;
    if ((record.shipmentFromId || record.shipmentToId) && (!GEOGRAPHY[record.shipmentFromId] || !GEOGRAPHY[record.shipmentToId])) continue;
    const action = record.shipmentFromId ? {...record,countryId:record.shipmentFromId,targetId:record.shipmentToId} : record;
    if (!GEOGRAPHY[action.countryId] || !GEOGRAPHY[action.targetId] || action.countryId === action.targetId || !ACTION_LABELS[action.type]) continue;
    liveRoutes.push({ ...action, label: ACTION_LABELS[action.type], liveAction: true });
  }
  const liveKeys = new Set(liveRoutes.map((route) => routeKey(route.countryId, route.targetId)));
  const restrictsLumen = player === 'lumen' && state.activePolicy === 'embargo';
  const routes = LUMEN_EXPORT_TARGETS
    .filter((targetId) => !liveKeys.has(routeKey('lumen', targetId)))
    .map((targetId) => ({ countryId: 'lumen', targetId, type: 'export', label: restrictsLumen ? '수출 제한' : '식량 수출', blocked: restrictsLumen }));
  routes.push(...liveRoutes);
  for (const agreement of state.agreements ?? []) {
    const targetId = agreement.targetId ?? player;
    if (!GEOGRAPHY[agreement.fromId] || !GEOGRAPHY[targetId] || agreement.fromId === targetId || agreement.endTurn <= state.turn || agreement.startTurn > state.turn) continue;
    routes.push({ countryId: agreement.fromId, targetId, type: 'agreement', label: agreement.type === 'technology' ? '기술 협정' : '공급 협정' });
  }
  return routes;
}

export function routeGeometry(fromId, toId, lane = null) {
  const from = GEOGRAPHY[fromId];
  const to = GEOGRAPHY[toId];
  if (!from || !to || fromId === toId) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const ux = dx / distance;
  const uy = dy / distance;
  const start = { x: from.x + ux * 94, y: from.y + uy * 85 };
  const end = { x: to.x - ux * 98, y: to.y - uy * 89 };
  const bend = lane ?? (fromId < toId ? 28 : -28);
  const control = { x: (start.x + end.x) / 2 - uy * bend, y: (start.y + end.y) / 2 + ux * bend };
  return { d: `M${start.x} ${start.y}Q${control.x} ${control.y} ${end.x} ${end.y}`, x: (start.x + 2 * control.x + end.x) / 4, y: (start.y + 2 * control.y + end.y) / 4 };
}

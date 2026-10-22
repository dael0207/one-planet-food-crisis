import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_IDS} from '../dist/engine.mjs';
import {normalizeChronicleOptions,renderChronicle} from '../dist/chronicle-ui.mjs';

const metrics=turn=>({food:60+turn,treasury:70-turn,price:100+turn,trust:65+turn,approval:62});
function point(turn,playerId='lumen'){
 const relations=Object.fromEntries(COUNTRY_IDS.filter(id=>id!==playerId).map((id,index)=>[id,55+index+turn]));
 return {turn,actionLabel:turn?'시설에 투자':'운영 시작',policyId:turn?'invest':'initial',eventTitle:turn?'봄비와 파종':'기준 시점',metrics:metrics(turn),beforeMetrics:metrics(Math.max(0,turn-1)),relations,relationEffects:turn===2?[{countryId:COUNTRY_IDS.find(id=>id!==playerId),before:56,after:62,delta:6,policyEffect:6}]:[],facilityLevel:turn>=3?1:0,facilityProduction:turn>=3?4:0,investmentCost:turn===1?16:0,cumulativeInvestmentCost:turn?16:0,cumulativeFacilityProduction:turn>=3?(turn-2)*4:0,development:{levelBefore:0,levelAfter:turn>=3?1:0,started:turn===1?[{dueTurn:3}]:[],completed:turn===3?[{dueTurn:3}]:[],ongoing:turn>0&&turn<3?[{dueTurn:3}]:[]},policyEffect:{food:2,treasury:turn===1?-16:0,price:-1,trust:1},worldEvents:[`세계 변화 ${turn}`]};
}
const model=(playerId='lumen',turns=4)=>({playerId,totalTurns:turns,points:Array.from({length:turns+1},(_,turn)=>point(turn,playerId)),projects:[]});

test('periods contain exactly twelve or forty completed quarter points',()=>{
 for(const period of [12,40]){
  const html=renderChronicle(model('lumen',145),{period});
  const path=html.match(/<path class="chart-line" d="([^"]+)"/)[1];
  assert.equal((path.match(/[ML]/g)||[]).length,period);
 }
 const all=renderChronicle(model('lumen',145),{period:'all'});
 assert.match(all,/145분기를 최대 120개 점으로 요약 표시/);assert.doesNotMatch(all,/146분기를/);
});

test('selected values stay in the chart caption and accessible names do not duplicate trend wording',()=>{
 const html=renderChronicle(model('lumen',145),{period:'all',turn:2});
 assert.match(html,/<figcaption>[\s\S]*선택 62점<\/span><\/figcaption>/);
 assert.doesNotMatch(html,/추이 추이|<text class="chart-value"/);
});

test('zero net relation changes still disclose direct effects without a false change badge',()=>{
 const value=model();value.points[2].relationEffects=[{countryId:'nord',before:57,after:57,delta:0,policyEffect:-1}];
 const html=renderChronicle(value,{turn:2,filter:'relations'});
 assert.match(html,/유지 대비 -1/);assert.match(html,/이 조건에 해당하는 기록이 없습니다/);
 const zero=model('lumen',1);zero.points[1].facilityLevel=0;zero.points[1].development={started:[],completed:[],ongoing:[]};zero.points[1].facilityProduction=0;
 assert.match(renderChronicle(zero),/운영 중인 시설 없음/);
});

test('empty campaign guides the player back without inventing charts',()=>{
 const html=renderChronicle({playerId:'lumen',totalTurns:0,points:[point(0)]});
 assert.match(html,/첫 결정을 내리면 기록이 시작됩니다/);assert.match(html,/data-action="show-view" data-view="decision"/);assert.doesNotMatch(html,/<svg/);
});

test('renders three accessible separate-unit charts and exact cumulative investment summary',()=>{
 const html=renderChronicle(model(),{turn:3,partner:'nord'});
 assert.equal((html.match(/<svg /g)||[]).length,3);assert.match(html,/루멘 식량 추이/);assert.match(html,/시설 실제 생산 추이/);assert.match(html,/노르드와의 관계/);
 assert.match(html,/시설 누적 지출[\s\S]*16억/);assert.match(html,/시설 누적 생산[\s\S]*8/);assert.match(html,/기본 생산 \+4\/분기/);
 assert.match(html,/선택 분기 수치 표로 보기/);
});

test('selected quarter separates total change, policy comparison, milestones and relation causes',()=>{
 const html=renderChronicle(model(),{turn:2,partner:'nord'});
 assert.match(html,/국가 총변화/);assert.match(html,/같은 세계에서 정책 직접 효과/);assert.match(html,/유지 정책 대비 값/);
 assert.match(html,/건설 중 1건/);assert.match(html,/선택한 국가 관계 · 노르드/);assert.match(html,/유지 대비 \+6/);assert.match(html,/세계 변화 2/);
});

test('normalizes invalid options and supports requested delegated control contracts',()=>{
 const value=normalizeChronicleOptions(model(),{period:99,metric:'approval',partner:'lumen',turn:99,filter:'nope',page:-9});
 assert.deepEqual(value,{period:12,metric:'food',partner:'nord',turn:4,filter:'all',page:0,pages:1});
 const html=renderChronicle(model(),value);
 for(const fragment of ['data-action="chronicle-turn"','data-action="chronicle-period"','name="chronicle-metric"','name="chronicle-partner"','name="chronicle-quarter"','data-action="chronicle-filter"','data-action="chronicle-page"'])assert.ok(html.includes(fragment),fragment);
});

test('long histories keep charts bounded and timeline paginated eight at a time',()=>{
 const long=model('lumen',240);long.points[13].metrics.food=999;long.points[14].metrics.food=-99;
 const html=renderChronicle(long,{period:'all',turn:137});
 assert.equal((html.match(/class="chronicle-entry/g)||[]).length,8);assert.match(html,/1 \/ 30/);
 for(const path of html.matchAll(/<path class="chart-line" d="([^"]+)"/g))assert.ok((path[1].match(/[ML]/g)||[]).length<=120);
 assert.match(html,/value="137" selected/);assert.match(html,/197점/);assert.match(html,/최저 -99점, 최고 999점/);assert.match(html,/최대 120개 점으로 요약 표시/);
});

test('recent range follows an explicitly selected older quarter',()=>{
 const html=renderChronicle(model('lumen',40),{period:12,turn:16});
 assert.match(html,/value="16" selected/);assert.match(html,/2034·4Q/);assert.doesNotMatch(html,/2040·4Q/);
});

test('investment and relation filters preserve truthful subsets',()=>{
 const investment=renderChronicle(model(),{filter:'investment'}),relations=renderChronicle(model(),{filter:'relations'});
 assert.equal((investment.match(/class="chronicle-entry/g)||[]).length,2);assert.match(investment,/1 \/ 1/);
 assert.equal((relations.match(/class="chronicle-entry/g)||[]).length,1);assert.match(relations,/관계 변화/);
});

test('investment detail keeps due date, delayed gain and later operating production visible',()=>{
 const started=renderChronicle(model(),{turn:1}),operating=renderChronicle(model(),{turn:4});
 assert.match(started,/완공 예정 2031년 3분기 · 2분기 남음/);assert.match(started,/완공 뒤 기본 생산 \+4\/분기/);
 assert.match(operating,/시설 1단계 운영 중 · 기본 생산 \+4\/분기/);assert.match(operating,/이번 분기 시설 실제 생산 <b>\+4<\/b>/);
});

test('price chart uses an index unit rather than a score',()=>{
 const html=renderChronicle(model(),{metric:'price'});assert.match(html,/루멘 생활물가 추이/);assert.match(html,/최저 100지수/);assert.doesNotMatch(html,/생활물가 추이 추이[^<]*점/);
});

test('all six countries render their own identity and five foreign partners',()=>{
 for(const id of COUNTRY_IDS){const html=renderChronicle(model(id,1));assert.match(html,/결정이 만든 흐름/);assert.equal((html.match(/<option value="(?:lumen|nord|cera|altia|marin|solis)"/g)||[]).length,5);assert.ok(!html.includes(`<option value="${id}"`));}
});

test('partial records disclose their boundary and preserve missing relations and facilities as gaps',()=>{
 const partial=model();partial.coverage='partial';partial.startTurn=1;partial.points[1].relations={};partial.points.at(-1).facilityLevel=null;
 const html=renderChronicle(partial,{turn:1,partner:'nord'});
 assert.match(html,/2031년 1분기부터의 기록/);assert.match(html,/저장되지 않은 이전 관계·시설 수치는 추정하지 않습니다/);
 assert.match(html,/현재 시설[\s\S]*기록 없음/);assert.match(html,/노르드 관계<\/th>[\s\S]*기록 없음/);
});

test('a partial campaign with one real quarter is a record, not an empty campaign',()=>{
 const partial={playerId:'lumen',totalTurns:86,coverage:'partial',startTurn:86,points:[point(86)]};partial.points[0].relations={};partial.points[0].facilityLevel=null;
 const html=renderChronicle(partial,{partner:'nord'});
 assert.doesNotMatch(html,/첫 결정을 내리면/);assert.match(html,/2052년 2분기부터의 기록/);assert.match(html,/기록 없음/);assert.equal((html.match(/class="chronicle-entry/g)||[]).length,1);
 assert.match(html,/전체 운영<\/span><b>86분기/);assert.match(html,/보유 기록 1분기/);
});

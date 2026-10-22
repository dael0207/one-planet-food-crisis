import {COUNTRIES,COUNTRY_IDS} from './country-data.mjs?v=29';
import {escape,signed} from './render.mjs?v=29';
import {quarterDate} from './calendar.mjs?v=29';
import {foreignStrategyContext} from './foreign-strategy.mjs?v=29';

const calendar=turn=>{const date=quarterDate(Math.max(0,turn-1));return `${date.year}년 ${date.quarter}분기`;};
const postureLabel={cooperate:'협력 중',contain:'견제 중',neutral:'중립'};
const active=state=>Number.isSafeInteger(state.foreignStrategyStartTurn)&&state.turn>=state.foreignStrategyStartTurn;

export function renderForeignStrategy(state,id){
 if(!COUNTRY_IDS.includes(id)||id===state.playerId||!active(state))return '';
 const strategy=state.foreignStrategies?.[id];if(!strategy)return '';
 const posture=state.turn<=strategy.postureUntil?strategy.posture:'neutral';
 const prior=strategy.previousAction,trend=strategy.trend??{food:0,treasury:0};
 const previous=prior?`<p>${escape(calendar(prior.turn))} · ${escape(prior.name)}</p>`:'<p>첫 전략 판단입니다. 이전 행동 결과는 다음 분기부터 비교합니다.</p>';
 const memory=posture==='neutral'?'현재 정책에 따른 추가 협상 선호 없음':`${escape(strategy.postureReason)} ${escape(calendar(strategy.postureUntil))}까지 기억 · 이후 재평가`;
 return `<div class="foreign-strategy-intel" data-foreign-strategy="${id}" data-strategy-mode="${escape(strategy.mode)}"><p><span>현재 전략</span><strong>${escape(strategy.label)}</strong></p><p><span>우리와의 태도</span><b data-strategy-posture="${escape(posture)}">${escape(postureLabel[posture]??postureLabel.neutral)}</b></p><details><summary>전략을 바꾼 이유</summary><p>${escape(strategy.reason)}</p>${previous}<p>지난 판단 이후 · 식량 ${signed(trend.food)} · 국고 ${signed(trend.treasury)}억</p><p>${memory}</p></details></div>`;
}

function reactionRow(state,event){
 const impact=event.playerImpact??{},effects=[];
 if(Number(impact.food))effects.push(`식량 ${signed(impact.food)}`);
 if(Number(impact.treasury))effects.push(`국고 ${signed(impact.treasury)}억`);
 if(Number(impact.relationDelta))effects.push(`관계 ${signed(impact.relationDelta)}`);
 if(event.operation==='withheld'&&event.withheldFood>0)effects.push(`공급 보류 ${event.withheldFood} · 실제 식량 이전 없음`);
 const strategy=state.foreignStrategies?.[event.countryId],context=foreignStrategyContext(state,event.countryId,'buy');
 if(context.scoreDelta&&event.type==='strategy')effects.push(`${postureLabel[context.posture]} · ${calendar(strategy.postureUntil)}까지 · 협상 선호 ${signed(context.scoreDelta)}점`);
 if(!effects.length)effects.push(event.type==='strategy'&&event.posture==='neutral'?'중립 · 추가 협상 선호 없음':impact.text??'현재 전략에 따라 다음 행동을 결정합니다.');
 const title=event.operation==='withheld'?'공개시장 공급 보류':event.mode?`${strategy?.label??event.mode}${context.scoreDelta?` · ${postureLabel[context.posture]}`:event.posture==='neutral'?' · 중립':''}`:event.title??'전략 변경';
 return `<div class="strategy-reaction" data-strategy-country="${escape(event.countryId)}"><span>${escape(COUNTRIES[event.countryId]?.name??'국제사회')}</span><strong>${escape(title)}</strong><p>${escape(event.reason??event.text??'')}</p>${event.reason&&event.text&&!event.text.endsWith(event.reason)?`<small>${escape(event.text)}</small>`:''}<b>${escape(effects.join(' · '))}</b></div>`;
}

export function renderStrategyResults(state){
 const events=(state.history?.at(-1)?.worldActions??[]).filter(event=>event.source==='foreign_strategy'||event.source==='foreign_site'&&event.operation==='withheld');
 if(!events.length)return '';
 const rank=event=>event.operation==='withheld'?3:event.posture&&event.posture!=='neutral'||event.previousPosture&&event.previousPosture!=='neutral'||event.playerImpact&&['food','treasury','relationDelta'].some(key=>Number(event.playerImpact[key]))?2:1;
 const seen=new Set(),rows=events.filter(event=>{const key=[event.source,event.countryId,event.targetId,event.type,event.operation,event.turn,event.mode,event.posture].join(':');if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>rank(b)-rank(a));
 const first=rows.slice(0,2),more=rows.slice(2);
 return `<section class="foreign-strategy-results" aria-label="다른 나라의 전략 변화"><h3>다른 나라의 전략 변화</h3>${first.map(event=>reactionRow(state,event)).join('')}${more.length?`<details><summary>나머지 대응 ${more.length}건</summary>${more.map(event=>reactionRow(state,event)).join('')}</details>`:''}</section>`;
}

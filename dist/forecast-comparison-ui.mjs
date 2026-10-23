import {escape} from './render.mjs?v=31';
import {forecastComparison,signed} from './forecast-comparison.mjs?v=34';

const facilityStatus=value=>{const text=String(value);return text.includes('완공')?'완공':text.includes('착공')?'착공':escape(text);};
const value=(item,key)=>item.key.startsWith('facility:')?facilityStatus(item[key]):typeof item[key]==='number'?`${item[key]}${item.unit}`:escape(item[key]);
const difference=row=>row.difference===0?(row.key.startsWith('facility:')?'일치':'0'):row.difference===null?'확인 필요':`${signed(row.difference)}${row.unit}`;

export function renderForecastComparison(state){
 const model=forecastComparison(state);
 if(model.status==='missing')return `<section class="forecast-comparison is-missing" aria-labelledby="forecast-comparison-title"><div><small>예상과 실제</small><h3 id="forecast-comparison-title">비교 기록 없음</h3></div><p>${escape(model.summary)}</p></section>`;
 const rows=model.rows.map(row=>`<div class="forecast-comparison-row" role="row" data-forecast-key="${escape(row.key)}"><span role="rowheader">${escape(row.label)}</span><b role="cell" data-value="expected">${value(row,'expected')}</b><strong role="cell" data-value="actual">${value(row,'actual')}</strong><i role="cell" data-tone="${row.difference===0?'matched':row.difference===null?'unknown':'different'}">${difference(row)}</i></div>`).join('');
 const detail=model.reasons.length?`<details open><summary>차이가 난 이유</summary>${model.reasons.map(reason=>`<p>${escape(reason)}</p>`).join('')}</details>`:`<details><summary>비교 기준</summary><p>실행 직전 지도에 표시된 예상과 이번 분기의 실제 기록이 일치했습니다.</p></details>`;
 return `<section class="forecast-comparison" data-status="${model.status}" aria-labelledby="forecast-comparison-title"><div class="forecast-comparison-heading"><small>예상과 실제</small><h3 id="forecast-comparison-title">${escape(model.summary)}</h3></div><div class="forecast-comparison-table" role="table" aria-label="실행 전 예상과 실제 결과 비교"><div class="forecast-comparison-head" role="row"><span role="columnheader">지표</span><b role="columnheader">예상</b><strong role="columnheader">실제</strong><i role="columnheader">차이</i></div>${rows}</div>${detail}</section>`;
}

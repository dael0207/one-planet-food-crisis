(function(){
 'use strict';
 let started=false;

 function start(){
  if(started)return;
  started=true;
  const status=document.getElementById('boot-status');
  const message=document.getElementById('boot-message');
  const retry=document.getElementById('boot-retry');
  const locked=[...document.querySelectorAll('[data-boot-lock]')];
  let settled=false;

  retry.addEventListener('click',()=>location.reload(),{once:true});

  function fail(error){
   if(settled)return;
   settled=true;
   console.error('게임 시작 실패',error);
   message.textContent='게임을 불러오지 못했습니다.';
   retry.hidden=false;
   status.removeAttribute('aria-busy');
   document.body.removeAttribute('aria-busy');
  }

  function ready(){
   if(settled)return;
   try{
    const country=document.getElementById('governed-name')?.textContent.trim();
    const controls=document.querySelectorAll('.map-site-target[data-country][data-site]');
    if(!country||controls.length!==18)throw new Error('초기 화면 준비 확인 실패');
    settled=true;
    for(const element of locked)element.removeAttribute('inert');
    status.hidden=true;
    document.body.classList.remove('boot-pending');
    document.body.removeAttribute('aria-busy');
   }catch(error){fail(error);}
  }

  const script=document.createElement('script');
  script.src='./game.bundle.js?v=33';
  script.onload=ready;
  script.onerror=fail;
  document.head.appendChild(script);
 }

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();

(()=>{
  if(!window.NUGU_WATCH_REELS_MODE)return;
  const config=window.NUGU_CONFIG||{},params=new URLSearchParams(location.search);
  const api=String(config.apiBase||'').replace(/\/$/,''),artist=(params.get('artist')||'').trim().toLowerCase();
  const shell=document.getElementById('mobileReelsShell'),feed=document.getElementById('mobileReelsFeed');
  const modeButtons=[...document.querySelectorAll('[data-reels-kind]')];
  if(!api||!shell||!feed)return;
  document.body.classList.add('mobile-reels-active');shell.hidden=false;

  let kind='all',offset=0,cycle=0,loading=false,ended=false,active=null,soundOn=false,paused=false,generation=0;
  const items=new Map(),times=new Map();
  const primed=new WeakSet(),priming=new WeakSet(),primeTimers=new WeakMap();
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmt=n=>Number.isFinite(Number(n))?new Intl.NumberFormat('ko',{notation:'compact',maximumFractionDigits:1}).format(Number(n)):'—';
  const keyOf=c=>String(c.platform)+':'+String(c.platform_content_id||c.content_id);
  const roomHref=c=>'room.html?artist='+encodeURIComponent(c.artist_slug||'');
  const listLink=document.getElementById('mobileReelsList');
  if(listLink){const q=new URLSearchParams(location.search);q.set('view','list');listLink.href='watch.html?'+q.toString()}

  function send(frame,func,args=[]){try{frame?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch{}}
  function flash(card,text){const el=card?.querySelector('.mobile-reel-state');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),650)}
  function currentSeconds(card=active){return Math.max(0,Math.floor(Number(times.get(card?.dataset.key)||0)))}
  function iframeUrl(c,start,autoplay=false){
    const id=encodeURIComponent(c.playback_id),origin=encodeURIComponent(location.origin);
    return 'https://www.youtube-nocookie.com/embed/'+id+'?autoplay='+(autoplay?1:0)+'&mute=1&controls=0&playsinline=1&rel=0&enablejsapi=1&origin='+origin+'&loop=1&playlist='+id+'&fs=0&disablekb=1'+(start?'&start='+start:'');
  }
  function card(c){
    const key=keyOf(c),p=c.thumbnail_url||c.artist_image_url||'',views=c.public_metrics?.views!=null?fmt(c.public_metrics.views)+' views · ':'';
    items.set(key,c);
    return '<article class="mobile-reel" data-key="'+esc(key)+'" data-video-id="'+esc(c.playback_id||'')+'">'+
      '<div class="mobile-reel-stage">'+(p?'<img class="mobile-reel-backdrop" src="'+esc(p)+'" alt="" loading="lazy" referrerpolicy="no-referrer"><img class="mobile-reel-poster" src="'+esc(p)+'" alt="'+esc(c.title)+'" loading="lazy" referrerpolicy="no-referrer">':'')+'<div class="mobile-reel-player"></div></div>'+
      '<div class="mobile-reel-gesture" aria-label="탭해서 재생 또는 일시정지"></div><div class="mobile-reel-shade"></div>'+
      '<div class="mobile-reel-meta"><a class="mobile-reel-artist" href="'+roomHref(c)+'">'+
      (c.artist_image_url?'<img src="'+esc(c.artist_image_url)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'')+
      '<span><b>'+esc(c.artist_name||'NUGU artist')+'</b><small>'+(c.artist_rank?'#'+esc(c.artist_rank)+' momentum · ':'')+esc(c.kind||'Official video')+'</small></span></a>'+
      '<h2>'+esc(c.title||'Official video')+'</h2><p>'+views+'✓ verified source</p></div>'+
      '<div class="mobile-reel-actions"><button type="button" class="mobile-reel-action reel-sound"><strong>🔇</strong><span>소리</span></button>'+
      '<button type="button" class="mobile-reel-action reel-comments"><strong>💬</strong><span>댓글</span></button>'+
      '<a class="mobile-reel-action reel-topkku" href="#"><strong>🎀</strong><span>탑꾸</span></a>'+
      '<a class="mobile-reel-action" href="'+roomHref(c)+'"><strong>🏠</strong><span>아지트</span></a>'+
      '<a class="mobile-reel-action" href="'+esc(c.content_url||'#')+'" target="_blank" rel="noopener"><strong>↗</strong><span>원본</span></a></div>'+
      '<div class="mobile-reel-hint">위로 넘기면 다음 영상</div><div class="mobile-reel-state"></div></article>';
  }
  function listenFrame(frame){
    if(!frame||frame.dataset.listenWired)return;frame.dataset.listenWired='1';
    const listen=()=>{try{frame.contentWindow?.postMessage(JSON.stringify({event:'listening',id:'nugu-reels'}),'*')}catch{}};
    frame.addEventListener('load',()=>{listen();setTimeout(listen,80);setTimeout(listen,320)},{once:true});
  }
  function ensureFrame(el,autoplay=false){
    if(!el)return null;
    const existing=el.querySelector('iframe');if(existing)return existing;
    const c=items.get(el.dataset.key),host=el.querySelector('.mobile-reel-player');if(!c?.playback_id||!host)return null;
    const iframe=document.createElement('iframe');iframe.src=iframeUrl(c,currentSeconds(el),autoplay);iframe.title=c.title||'NUGU RADAR video';iframe.allow='autoplay; encrypted-media; picture-in-picture; web-share';iframe.setAttribute('allowfullscreen','');iframe.setAttribute('loading','eager');host.appendChild(iframe);listenFrame(iframe);return iframe;
  }
  function playActive(el){
    if(!el||el!==active||paused||document.hidden)return;
    const frame=ensureFrame(el,true);if(!frame)return;
    const kick=()=>{
      if(el!==active||paused||document.hidden)return;
      send(frame,'mute');
      send(frame,'playVideo');
      if(soundOn){send(frame,'unMute');send(frame,'setVolume',[100])}
    };
    kick();[80,220,520,950].forEach(ms=>setTimeout(kick,ms));
  }
  function cancelPrime(cardEl){
    if(!cardEl)return;
    const timer=primeTimers.get(cardEl);if(timer)clearTimeout(timer);
    primeTimers.delete(cardEl);priming.delete(cardEl);
  }
  function finishPrime(cardEl,frame){
    if(!cardEl||cardEl===active||!cardEl.isConnected)return;
    const timer=primeTimers.get(cardEl);if(timer)clearTimeout(timer);
    primeTimers.delete(cardEl);priming.delete(cardEl);primed.add(cardEl);cardEl.classList.add('player-ready');
    send(frame,'pauseVideo');
  }
  function primeCard(cardEl){
    if(!cardEl||cardEl===active||primed.has(cardEl)||priming.has(cardEl))return;
    const frame=ensureFrame(cardEl,true);if(!frame)return;
    priming.add(cardEl);
    const kick=()=>{
      if(cardEl===active||!cardEl.isConnected){cancelPrime(cardEl);return}
      send(frame,'mute');send(frame,'playVideo');
    };
    kick();[90,240,520,1050].forEach(ms=>setTimeout(kick,ms));
    const timer=setTimeout(()=>{
      if(cardEl===active||!cardEl.isConnected){cancelPrime(cardEl);return}
      send(frame,'pauseVideo');priming.delete(cardEl);primeTimers.delete(cardEl);
    },3200);
    primeTimers.set(cardEl,timer);
  }
  function warmAround(el){
    const cards=[...feed.querySelectorAll('.mobile-reel')],idx=cards.indexOf(el);if(idx<0)return;
    const previous=cards[idx-1],next=cards[idx+1];
    const keep=new Set([previous,cards[idx],next].filter(Boolean));
    ensureFrame(cards[idx],true);
    if(previous){const frame=ensureFrame(previous,false);if(frame)send(frame,'pauseVideo')}
    if(next)primeCard(next);
    for(const cardEl of cards){
      if(keep.has(cardEl))continue;
      cancelPrime(cardEl);primed.delete(cardEl);cardEl.classList.remove('player-ready');
      const host=cardEl.querySelector('.mobile-reel-player');if(host?.querySelector('iframe'))host.innerHTML='';
    }
  }
  function wireCard(el){
    if(el.dataset.wired)return;el.dataset.wired='1';const c=items.get(el.dataset.key);
    el.querySelector('.mobile-reel-gesture')?.addEventListener('click',()=>{const frame=ensureFrame(el,el===active);if(!frame)return;paused=!paused;send(frame,paused?'pauseVideo':'playVideo');if(!paused)playActive(el);flash(el,paused?'일시정지':'재생')});
    el.querySelector('.reel-sound')?.addEventListener('click',e=>{e.stopPropagation();soundOn=!soundOn;const frame=ensureFrame(el,el===active);send(frame,soundOn?'unMute':'mute');if(soundOn)send(frame,'setVolume',[100]);if(el===active&&!paused)send(frame,'playVideo');document.querySelectorAll('.reel-sound').forEach(b=>{b.classList.toggle('sound-on',soundOn);b.querySelector('strong').textContent=soundOn?'🔊':'🔇';b.querySelector('span').textContent=soundOn?'소리 켬':'소리'});flash(el,soundOn?'소리 켬':'음소거')});
    el.querySelector('.reel-comments')?.addEventListener('click',e=>{e.stopPropagation();const frame=el.querySelector('iframe');send(frame,'pauseVideo');paused=true;window.NUGU_WATCH_OPEN_CONTENT?.(c,currentSeconds(el))});
    el.querySelector('.reel-topkku')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();location.href='watch.html?artist='+encodeURIComponent(c.artist_slug||'')+'&video='+encodeURIComponent(c.playback_id||'')+'&t='+currentSeconds(el)+'&topkku=1'});
  }
  function deactivate(el){if(!el)return;send(el.querySelector('iframe'),'pauseVideo');el.classList.remove('active')}
  function activate(el){
    if(!el)return;
    if(el===active){if(!paused)playActive(el);return}
    cancelPrime(el);
    deactivate(active);active=el;paused=false;el.classList.add('active');el.classList.toggle('player-ready',primed.has(el));ensureFrame(el,true);playActive(el);warmAround(el);
    const cards=[...feed.querySelectorAll('.mobile-reel')],idx=cards.indexOf(el);if(idx>=cards.length-4)loadMore();setTimeout(trimBehind,80);
  }
  function trimBehind(){
    const children=[...feed.querySelectorAll('.mobile-reel')];if(children.length<=36||!active)return;const idx=children.indexOf(active);if(idx<18)return;
    const remove=children.slice(0,10),height=remove.reduce((n,x)=>n+x.offsetHeight,0);remove.forEach(x=>{observer.unobserve(x);x.remove()});feed.scrollTop=Math.max(0,feed.scrollTop-height);
  }
  const observer=new IntersectionObserver(entries=>{
    let best=null;for(const e of entries)if(e.isIntersecting&&e.intersectionRatio>=.38&&(!best||e.intersectionRatio>best.intersectionRatio))best=e;
    if(best)activate(best.target);
  },{root:feed,threshold:[.2,.38,.55,.75,.92]});
  function append(rows){
    const playable=rows.filter(x=>x.playable&&x.playback_provider==='youtube'&&x.playback_id);if(!playable.length)return 0;
    feed.querySelector('.mobile-reels-loading')?.remove();feed.insertAdjacentHTML('beforeend',playable.map(card).join(''));
    [...feed.querySelectorAll('.mobile-reel:not([data-observed])')].forEach(el=>{el.dataset.observed='1';wireCard(el);observer.observe(el)});
    if(active)warmAround(active);
    return playable.length;
  }
  async function loadMore(){
    if(loading||ended)return;loading=true;const gen=generation;
    try{
      const q=new URLSearchParams({limit:'12',offset:String(offset),cycle:String(cycle),platform:'youtube',kind,sort:'newest'});if(artist)q.set('artist',artist);
      const r=await fetch(api+'/api/v1/content?'+q.toString(),{headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
      const data=await r.json();if(gen!==generation)return;const rows=Array.isArray(data.items)?data.items:[];append(rows);offset=Number(data.nextOffset||offset+rows.length);
      if(!data.hasMore){cycle+=1;offset=0;if(!rows.length&&kind!=='all'){ended=true;if(!feed.querySelector('.mobile-reel')){feed.innerHTML='<div class="mobile-reels-loading mobile-reels-error">지금은 Shorts가 없어요.<button type="button" id="reelsAll">전체 영상 보기</button></div>';document.getElementById('reelsAll')?.addEventListener('click',()=>reset('all'))}}else if(!rows.length&&kind==='all'){setTimeout(loadMore,80)}}
      if(!active){const first=feed.querySelector('.mobile-reel');if(first){activate(first);requestAnimationFrame(()=>warmAround(first))}}
    }catch(e){
      console.warn('mobile reels load failed',e);if(!feed.querySelector('.mobile-reel')){feed.innerHTML='<div class="mobile-reels-loading mobile-reels-error">영상을 불러오지 못했어요.<button type="button" id="reelsRetry">다시 시도</button></div>';document.getElementById('reelsRetry')?.addEventListener('click',loadMore)}
    }finally{if(gen===generation)loading=false}
  }
  function reset(nextKind){
    generation++;deactivate(active);[...feed.querySelectorAll('.mobile-reel')].forEach(cancelPrime);active=null;kind=nextKind;offset=0;cycle=0;ended=false;loading=false;items.clear();times.clear();feed.scrollTop=0;feed.innerHTML='<div class="mobile-reels-loading">검증된 영상을 불러오는 중…</div>';modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.reelsKind===kind));loadMore();
  }
  modeButtons.forEach(b=>b.addEventListener('click',()=>{if(!b.hidden)reset(b.dataset.reelsKind||'all')}));
  window.addEventListener('nugu-shorts-availability',e=>{
    const available=Boolean(e.detail?.available),short=modeButtons.find(b=>b.dataset.reelsKind==='Shorts');if(short)short.hidden=!available;
    if(!available&&kind==='Shorts')reset('all');
  });
  window.addEventListener('message',e=>{
    const frames=[...feed.querySelectorAll('iframe')],frame=frames.find(x=>e.source===x.contentWindow);if(!frame)return;
    let data=e.data;try{if(typeof data==='string')data=JSON.parse(data)}catch{return}
    const cardEl=frame.closest('.mobile-reel'),t=Number(data?.info?.currentTime);if(cardEl&&Number.isFinite(t)&&t>=0)times.set(cardEl.dataset.key,t);
    if(cardEl&&cardEl!==active&&priming.has(cardEl)&&Number.isFinite(t)&&t>=.12)finishPrime(cardEl,frame);
    if(cardEl===active&&Number.isFinite(t)&&t>=.02)cardEl.classList.add('player-ready');
    if(cardEl===active&&(data?.event==='onReady'||data?.event==='initialDelivery')&&!paused)playActive(cardEl);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)send(active?.querySelector('iframe'),'pauseVideo');else if(active&&!paused)playActive(active)});
  reset('all');
})();
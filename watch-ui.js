(()=>{
  const player=document.getElementById('watchPlayer');
  const playerBody=document.getElementById('playerBody');
  const feed=document.getElementById('watchFeed');
  if(!player||!playerBody)return;

  let portraitNext=false;
  let latestTime=0;

  const ytId=url=>{
    const s=String(url||'');
    let m=s.match(/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([^/]+)\//i);
    if(m)return m[1];
    m=s.match(/[?&]v=([^&#]+)/i);
    if(m)return m[1];
    m=s.match(/youtu\.be\/([^?&#/]+)/i);
    return m?m[1]:'';
  };

  function qualityCandidates(img){
    const original=img.dataset.direct||img.getAttribute('src')||'';
    const id=ytId(original)||ytId(img.getAttribute('src'));
    const rows=[];
    const push=u=>{if(u&&!rows.includes(u))rows.push(u)};
    if(id){
      push(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`);
      push(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/sddefault.jpg`);
      push(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`);
    }
    push(original);
    push(img.dataset.fallback);
    return rows;
  }

  function upgradeThumb(img){
    if(!img||img.dataset.qualityWired)return;
    img.dataset.qualityWired='1';
    const candidates=qualityCandidates(img);
    if(!candidates.length)return;
    let idx=0;
    const apply=()=>{
      if(idx>=candidates.length){img.dataset.quality='fallback';return}
      img.src=candidates[idx];
      img.dataset.quality=idx===0?'max':idx===1?'sd':idx===2?'hq':'fallback';
    };
    img.addEventListener('error',()=>{idx++;apply()});
    img.addEventListener('load',()=>{
      if(img.naturalWidth&&img.naturalWidth<480&&idx<candidates.length-1){idx++;apply()}
    });
    apply();
  }

  function scanThumbs(root){
    if(!root)return;
    if(root.matches?.('.watch-thumb img'))upgradeThumb(root);
    root.querySelectorAll?.('.watch-thumb img').forEach(upgradeThumb);
  }

  function cardLooksPortrait(card){
    if(!card)return false;
    const kind=(card.querySelector('.watch-artist small')?.textContent||'').toLowerCase();
    const title=(card.querySelector('.watch-copy h2')?.textContent||'').toLowerCase();
    return kind.includes('shorts')||title.includes('#shorts')||title.includes(' shorts');
  }

  document.addEventListener('pointerdown',e=>{
    const card=e.target.closest?.('.watch-card');
    if(card)portraitNext=cardLooksPortrait(card);
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const card=e.target.closest?.('.watch-card');
    if(card)portraitNext=cardLooksPortrait(card);
  },true);

  const playerIframe=()=>playerBody.querySelector('.player-frame iframe');

  function sendYoutube(func,args=[]){
    const frame=playerIframe();
    if(!frame?.contentWindow)return;
    try{frame.contentWindow.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch{}
  }

  function enableYoutubeApi(){
    const frame=playerIframe();
    if(!frame||frame.dataset.nuguApiReady)return;
    frame.dataset.nuguApiReady='1';
    const listen=()=>{
      try{frame.contentWindow?.postMessage(JSON.stringify({event:'listening',id:'nugu-radar-watch'}),'*')}catch{}
    };
    frame.addEventListener('load',listen);
    setTimeout(listen,0);
  }

  const preciseTimeLabel=s=>{
    const n=Math.max(0,Number(s)||0),m=Math.floor(n/60),sec=n-m*60;
    return `${m}:${sec.toFixed(1).padStart(4,'0')}`;
  };

  function updateSceneTime(){
    const el=playerBody.querySelector('#frameTopkkuTime');
    if(el)el.textContent=preciseTimeLabel(latestTime);
  }

  function captureMessage(text,state=''){
    const el=playerBody.querySelector('#frameTopkkuState');
    if(el){el.textContent=text;el.dataset.state=state}
  }

  window.addEventListener('message',e=>{
    const frame=playerIframe();
    if(!frame||e.source!==frame.contentWindow)return;
    let data=e.data;
    try{if(typeof data==='string')data=JSON.parse(data)}catch{return}
    const t=Number(data?.info?.currentTime);
    if(Number.isFinite(t)&&t>=0){latestTime=t;updateSceneTime()}
  });

  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  async function nudgeFrame(delta){
    const buttons=[...playerBody.querySelectorAll('.frame-nudge button')];
    buttons.forEach(b=>b.disabled=true);
    try{
      const next=Math.max(0,Math.round((Number(latestTime||0)+Number(delta||0))*10)/10);
      latestTime=next;
      sendYoutube('pauseVideo');
      sendYoutube('seekTo',[next,true]);
      updateSceneTime();
      await wait(140);
      sendYoutube('pauseVideo');
      captureMessage(`${preciseTimeLabel(next)} 장면을 골랐어요. 더 미세하게 맞추거나 바로 탑꾸해보세요.`,'picked');
    }finally{
      buttons.forEach(b=>b.disabled=false);
    }
  }

  function wireFrameAction(){
    const title=playerBody.querySelector('.player-title');
    if(!title||title.querySelector('#frameTopkkuButton'))return;
    enableYoutubeApi();
    const wrap=document.createElement('div');
    wrap.className='frame-topkku-action';
    wrap.innerHTML=`<div class="frame-scene-head"><b>딱 이 표정으로</b><strong id="frameTopkkuTime">${preciseTimeLabel(latestTime)}</strong></div><div class="frame-nudge" aria-label="장면 미세 선택"><button type="button" data-step="-0.2">−0.2초</button><button type="button" data-step="-0.1">−0.1초</button><button type="button" data-step="0.1">+0.1초</button><button type="button" data-step="0.2">+0.2초</button></div><button id="frameTopkkuButton" type="button">✨ 이 장면 탑꾸</button><span id="frameTopkkuState">원하는 표정에 맞춘 뒤 눌러보세요. 실제 영상 영역만 가져와요.</span>`;
    title.appendChild(wrap);
    wrap.querySelectorAll('.frame-nudge button').forEach(b=>b.addEventListener('click',()=>nudgeFrame(Number(b.dataset.step))));
    updateSceneTime();
  }

  function syncPlayer(){
    if(!player.open)return;
    const title=(playerBody.querySelector('.player-title h2')?.textContent||'').toLowerCase();
    const portrait=portraitNext||title.includes('#shorts')||title.includes(' shorts');
    player.classList.toggle('is-vertical',portrait);
    wireFrameAction();
    enableYoutubeApi();
    updateSceneTime();
  }

  window.addEventListener('nugu-watch-opened',syncPlayer);

  const playerObserver=new MutationObserver(()=>{
    if(player.open)queueMicrotask(syncPlayer);
  });
  playerObserver.observe(playerBody,{childList:true});

  if(feed){
    const feedObserver=new MutationObserver(mutations=>{
      for(const m of mutations){
        for(const n of m.addedNodes){
          if(n.nodeType===1)scanThumbs(n);
        }
      }
    });
    feedObserver.observe(feed,{childList:true});
    scanThumbs(feed);
  }

  player.addEventListener('close',()=>{
    player.classList.remove('is-vertical');
    portraitNext=false;
    latestTime=0;
  });
})();

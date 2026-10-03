(()=>{
  const $=s=>document.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const params=new URLSearchParams(location.search);
  const captureWindow=params.get('capture')==='1';
  const frame=$('#videoFrame'),viewport=$('#videoViewport'),caption=$('#videoCaption'),touch=$('#videoTouch');
  const status=$('#videoStatus'),sceneState=$('#sceneState'),download=$('#videoDownload'),captureSave=$('#captureWindowSave'),captureResult=$('#captureWindowResult');
  const api=String((window.NUGU_CONFIG||{}).apiBase||'').replace(/\/$/,'');
  const STORY_INFO={
    fan:{
      kicker:'FAN FILM · 약 60초',
      title:'발견하고, 같이 놀고, 오래 좋아한 흔적이 남는다.',
      desc:'원석 발견부터 Watch·탑꾸·Pick·아지트·Radar Time/Glow·팬 활동·성장·선물·졸업 기록까지 핫바지의 전체 덕질 루프를 실제 화면으로 압축합니다.',
      steps:['원석을 먼저 발견','Watch를 계속 넘기기','꽂힌 장면 → 탑꾸','7초 직접 꾸미기','취향함·취향대결','Pick → 우리 아지트','Radar Time → Glow','팬덤 온도·전광판·Live Pulse','성장 편지·덕질 결·선물','커져도 기록은 남기기']
    },
    investor:{
      kicker:'INVESTOR FILM · 약 66초',
      title:'발견에서 팬 커뮤니티와 장기 리텐션까지 한 루프로.',
      desc:'발견·연속시청·UGC·Pick·아지트 체류·Glow·소셜 가시성·성장·팬간 선물·졸업 아카이브까지 제품 전체 루프를 실제 화면으로 보여줍니다.',
      steps:['Discovery surface','Continuous Watch','One-click UGC','7초 실제 편집','Social UGC','Pick & Hideout','Time → Glow','Fandom activity visibility','Growth · traits · gifts','Graduation archive']
    }
  };
  const DECORATION_MONTAGE_TARGET_MS=7000;
  let selectedStory=params.get('story')==='investor'?'investor':'fan';
  let running=false,runId=0,recorder=null,recordStream=null,chunks=[],downloadUrl='',lastRecordingBlob=null,safetyTimer=null,source=null;

  function setStatus(text){if(status)status.textContent=text}
  const escHtml=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  function setScene(text,idx){if(sceneState)sceneState.textContent=text||'';document.querySelectorAll('#storyOutline li').forEach((el,i)=>el.classList.toggle('active',i===idx))}
  function renderStory(){
    const info=STORY_INFO[selectedStory];
    $('#storyKicker').textContent=info.kicker;$('#storyTitle').textContent=info.title;$('#storyDesc').textContent=info.desc;
    $('#storyOutline').innerHTML=info.steps.map((x,i)=>'<li><span>'+String(i+1).padStart(2,'0')+'</span><b>'+x+'</b></li>').join('');
    document.querySelectorAll('[data-story]').forEach(b=>b.classList.toggle('active',b.dataset.story===selectedStory));
    if($('#captureGateTitle'))$('#captureGateTitle').textContent=selectedStory==='fan'?'팬용 세로 촬영':'투자자용 세로 촬영';
    const q=new URLSearchParams(location.search);if(captureWindow)q.set('capture','1');q.set('story',selectedStory);
    if(!running)history.replaceState({},'',location.pathname+'?'+q.toString());
  }
  function frameDoc(){try{return frame.contentDocument||frame.contentWindow.document}catch{return null}}
  async function waitFrame(selector,timeout=12000){
    const start=performance.now();while(performance.now()-start<timeout){const doc=frameDoc(),el=doc?.querySelector(selector);if(el)return el;await wait(100)}return null;
  }
  async function waitFramePath(fragment,timeout=32000){
    const start=performance.now();while(performance.now()-start<timeout){try{if(String(frame.contentWindow.location.pathname||'').includes(fragment))return true}catch{}await wait(120)}return false;
  }
  async function waitSelection(timeout=10000){
    const start=performance.now();while(performance.now()-start<timeout){const el=frameDoc()?.querySelector('#selectionState');if(el&&/장면을 가져왔어요|꾸미는 중/.test(el.textContent||''))return true;await wait(120)}return false;
  }
  async function loadFrame(url,selector){
    setScene('화면 준비 중…');
    await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);frame.removeEventListener('load',finish);resolve()};const timer=setTimeout(finish,9000);frame.addEventListener('load',finish);frame.src=url});
    if(selector)await waitFrame(selector,12000);
    await wait(220);
  }
  async function focusFrame(selector,block='center'){
    const el=await waitFrame(selector,8000);if(!el)return null;
    try{el.scrollIntoView({behavior:'smooth',block})}catch{}
    await wait(520);return el;
  }
  async function showCaption(text,kicker='TOPKKU',hold=1300){
    if(!text)return;
    caption.querySelector('span').textContent=kicker;caption.querySelector('strong').textContent=text;
    caption.classList.remove('leave');requestAnimationFrame(()=>caption.classList.add('show'));
    await wait(Math.max(420,hold-190));caption.classList.add('leave');await wait(190);caption.classList.remove('show','leave');
  }
  async function tapElement(el,after=420){
    if(!el)return false;
    try{el.scrollIntoView({behavior:'smooth',block:'center'})}catch{}
    await wait(260);
    const r=el.getBoundingClientRect();touch.style.left=(r.left+r.width/2)+'px';touch.style.top=(r.top+r.height/2)+'px';
    touch.classList.remove('active');void touch.offsetWidth;touch.classList.add('active');await wait(120);
    try{el.click()}catch{return false}
    await wait(after);return true;
  }
  async function tapFrame(selector,after=420){
    const el=await waitFrame(selector,8000);return tapElement(el,after);
  }
  async function waitReelCards(min=6,timeout=12000){
    const start=performance.now();let cards=[];
    while(performance.now()-start<timeout){
      cards=[...(frameDoc()?.querySelectorAll('.mobile-reel')||[])];
      if(cards.length>=min)return cards;
      const feed=frameDoc()?.querySelector('#mobileReelsFeed');if(feed)feed.scrollTop=feed.scrollHeight;
      await wait(220);
    }
    return cards;
  }
  function sourceFromReel(card){
    if(!card)return;
    let artistSlug='';
    try{artistSlug=new URL(card.querySelector('.mobile-reel-artist')?.href||'',location.href).searchParams.get('artist')||''}catch{}
    source={...(source||{}),playback_id:card.dataset.videoId||source?.playback_id||'',artist_slug:artistSlug||source?.artist_slug||'',artist_name:card.querySelector('.mobile-reel-artist b')?.textContent?.trim()||source?.artist_name||'',title:card.querySelector('h2')?.textContent?.trim()||source?.title||''};
  }
  async function rapidSwipeWatch(run,fanMode){
    const cards=await waitReelCards(7,12000);if(!cards.length)return null;
    setScene('Watch · 계속 넘기는 중',1);
    await showCaption(fanMode?'또 넘기고. 또 넘기고. 또 넘기고.':'공식 콘텐츠를 끊김 없이 연속 소비합니다.',fanMode?'WATCH':'WATCH · CONTINUOUS FEED',720);
    const count=Math.min(7,cards.length);
    for(let i=0;i<count;i++){
      if(run!==runId)return null;
      try{cards[i].scrollIntoView({behavior:'smooth',block:'start'})}catch{}
      await wait(i===count-1?620:285);
    }
    const target=cards[count-1];sourceFromReel(target);return target;
  }
  async function resolveSource(){
    if(source||!api)return source;
    try{
      const q=new URLSearchParams({limit:'24',offset:'0',cycle:'0',platform:'youtube',kind:'all',sort:'newest'});
      const r=await fetch(api+'/api/v1/content?'+q.toString(),{headers:{Accept:'application/json'},cache:'no-store'});
      if(!r.ok)throw new Error('content_'+r.status);
      const data=await r.json(),rows=Array.isArray(data.items)?data.items:[];
      source=rows.find(x=>x.playable&&x.playback_provider==='youtube'&&x.playback_id&&x.artist_slug)||rows.find(x=>x.playback_id)||null;
    }catch(err){console.warn('TOPKKU_VIDEO_SOURCE_FALLBACK',err)}
    return source;
  }
  function watchUrl(){
    const q=new URLSearchParams({view:'reels'});if(source?.playback_id)q.set('start',source.playback_id);if(source?.artist_slug)q.set('artist',source.artist_slug);
    return 'watch.html?'+q.toString();
  }
  const blobDataUrl=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('read'));r.onload=()=>resolve(String(r.result||''));r.readAsDataURL(blob)});
  async function canonicalHandoff(){
    if(!api||!source?.playback_id)return false;
    const requested=2.5,ac=new AbortController(),timer=setTimeout(()=>ac.abort(),30000);
    try{
      const r=await fetch(api+'/api/v1/media/youtube-frame',{method:'POST',headers:{'Content-Type':'application/json',Accept:'image/jpeg'},body:JSON.stringify({videoId:source.playback_id,time:requested}),signal:ac.signal});
      if(!r.ok)throw new Error('frame_'+r.status);
      const blob=await r.blob(),image=await blobDataUrl(blob),width=Number(r.headers.get('X-NUGU-Frame-Width')||0),height=Number(r.headers.get('X-NUGU-Frame-Height')||0),capturedVideoTime=Number(r.headers.get('X-NUGU-Frame-Time')||requested);
      if(!image||width<64||height<64)throw new Error('invalid_frame');
      sessionStorage.setItem('nuguTopkkuIncoming',JSON.stringify({version:18,source:'watch',image,artist:source.artist_name||'',artistSlug:source.artist_slug||'',title:source.title||'',contentUrl:source.content_url||'',videoId:source.playback_id,time:requested,capturedVideoTime,capturedAt:new Date().toISOString(),cleanCapture:true,videoOnly:true,strictCapture:true,manualCapture:false,captureMode:'video-studio-server-decoded-frame-v1',width,height,quality:{uiFree:true,source:'decoded-video-element'},geometry:{mode:'server-video-element'}}));
      await loadFrame('topkku.html?from=video-studio-canonical','#topkkuCanvas');return true;
    }catch(err){console.warn('TOPKKU_VIDEO_CANONICAL_HANDOFF_FAILED',err);return false}
    finally{clearTimeout(timer)}
  }
  async function watchIntoTopkku(run,fanMode){
    setScene('Watch · 실제 영상',1);
    await loadFrame(watchUrl(),'.mobile-reel');
    if(run!==runId)return false;
    const target=await rapidSwipeWatch(run,fanMode);if(!target||run!==runId)return false;
    await showCaption(fanMode?'어, 잠깐. 이 표정.':'연속 소비 중 강한 한 순간이 바로 창작 진입점이 됩니다.',fanMode?'멈춘 순간':'MOMENT → CREATION',980);
    const clicked=await tapElement(target.querySelector('.reel-topkku'),120);
    if(clicked)await showCaption(fanMode?'그 순간 그대로, 탑꾸.':'재생 중 1클릭 → 정확한 프레임 → UGC 시작.',fanMode?'ONE TAP':'ONE-CLICK UGC',1080);
    let reached=clicked?await waitFramePath('topkku.html',32000):false;
    if(!reached){setScene('정식 프레임 경로 재시도',2);reached=await canonicalHandoff()}
    if(!reached)return false;
    await waitFrame('#topkkuCanvas',10000);await waitSelection(10000);await wait(520);
    return run===runId;
  }
  function editorFrameState(){try{return frame.contentWindow.__NUGU_TOPKKU_FRAME_STATE__?.()||null}catch{return null}}
  function editorDemoApi(){try{return frame.contentWindow.NUGU_TOPKKU_VIDEO_DEMO||null}catch{return null}}
  async function waitElementAdded(before,timeout=2800){
    const start=performance.now();while(performance.now()-start<timeout){if(Number(editorFrameState()?.elementCount||0)>before)return true;await wait(70)}return false;
  }
  async function addDemoSticker(id,placement){
    const before=Number(editorFrameState()?.elementCount||0);
    const ok=await tapFrame('[data-sticker-id="'+id+'"]',90);if(!ok)return false;
    await waitElementAdded(before,2800);editorDemoApi()?.positionSelected?.(placement);await wait(120);return true;
  }
  async function decorateTopkku(run,fanMode){
    const montageStart=performance.now();
    setScene('탑꾸 · 7초 압축 꾸미기',2);
    await showCaption(fanMode?'예쁜 것만 골라서, 바로 붙인다.':'실제 스티커 선택과 배치를 7초 안에 압축해 보여줍니다.',fanMode?'TOPKKU':'EDITOR · REAL ACTIONS',700);
    if(run!==runId)return false;
    await tapFrame('[data-theme="pink"]',70);
    await tapFrame('[data-sticker-pack="시그니처"]',70);
    await addDemoSticker('big-ribbon-pink',{x:.20,y:.18,sizeScale:.62,rotation:-.10});
    await addDemoSticker('satin-bow-pearl-pink',{x:.80,y:.20,sizeScale:.56,rotation:.08});
    await addDemoSticker('lace-strip-white',{x:.50,y:.84,sizeScale:.86,rotation:.015});
    if(run!==runId)return false;
    await tapFrame('[data-sticker-pack="다꾸"]',70);
    await addDemoSticker('tape-pink',{x:.21,y:.70,sizeScale:1.08,rotation:-.12});
    await addDemoSticker('note-paper',{x:.80,y:.70,sizeScale:.92,rotation:.07});
    if(fanMode)await tapFrame('[data-copy="우리만 알던 시절"]',80);
    await tapFrame('#topkkuPackageOptions [data-shell-id="opp-flap"]',90);
    await tapFrame('#topkkuSealOptions [data-shell-id="for-you"]',90);
    editorDemoApi()?.clearSelection?.();
    await showCaption(fanMode?'OPP 봉투에 넣고, For you 씰로 끝.':'완성작은 OPP 포장과 씰까지 하나의 결과물로 마감됩니다.',fanMode?'PACK IT ♡':'PACKAGING',780);
    const remain=DECORATION_MONTAGE_TARGET_MS-(performance.now()-montageStart);if(remain>0)await wait(remain);
    return run===runId;
  }

  async function showTopkkuSocial(run,fanMode){
    setScene('탑꾸 · 다른 팬 취향과 연결',4);
    await focusFrame('#topkkuGallery','start');
    await showCaption(fanMode?'예쁜 건 취향함에 담고, 또 따라 꾸민다.':'UGC는 취향함·참고꾸미기로 다시 창작을 만듭니다.',fanMode?'취향함':'SOCIAL UGC',760);
    if(run!==runId)return false;
    await focusFrame('#topkkuBalance','center');
    await showCaption(fanMode?'이번 주엔 둘 중 뭐가 더 좋은지도 고르고.':'주간 취향대결이 오래된 작품까지 다시 발견시킵니다.',fanMode?'취향대결':'WEEKLY BATTLE',700);
    if(run!==runId)return false;
    await focusFrame('#topkkuMakerTrend','center');
    await wait(220);return run===runId;
  }
  function applyHideoutVideoState(){
    const doc=frameDoc();if(!doc)return;
    const pick=doc.querySelector('#pickPanel'),time=doc.querySelector('#timePanel');
    if(pick)pick.innerHTML='<h2>내 레이더에 있어 ♡</h2><p>처음 찍어둔 순간 · 내가 먼저 발견한 기록도 그대로 보관 중.</p><button class="pick-button secondary" type="button">My Radar · Pick 완료 ✓</button><div class="community-message">이 팀 아지트에서 같이 놀 수 있어요.</div>';
    if(time)time.innerHTML='<h2>Radar Time</h2><p>이 방에서 진짜 머문 시간만 쌓여요.</p><div class="timer-display">24m 18s</div><div class="timer-note">24m 모음 · 이번 방문 6m</div><div class="glow-actions"><button class="glow-button" type="button">응원 +1m</button><button class="glow-button" type="button">응원 +5m</button></div><div class="community-message">모은 시간을 이 팀에게 보내기 ♡</div>';
  }
  async function showHideoutCore(run,fanMode){
    const slug=source?.artist_slug;if(!slug)return run===runId;
    setScene('Pick · 우리 아지트',5);
    await loadFrame('room.html?artist='+encodeURIComponent(slug),'#roomHero');await wait(650);applyHideoutVideoState();
    await focusFrame('#roomHero','center');
    await showCaption(fanMode?'찾았으면 그냥 보고 끝이 아니라, 우리방이 생긴다.':'Pick이 발견을 팬 아지트와 장기 관계로 연결합니다.',fanMode?'우리 아지트':'PICK → HIDEOUT',850);
    if(run!==runId)return false;
    await focusFrame('#pickPanel','center');
    await showCaption(fanMode?'내 팀으로 Pick. 먼저 좋아한 순간도 남고.':'Pick은 최대 세 팀의 초기 발견 기록과 커뮤니티 참여를 묶습니다.',fanMode?'PICK ♡':'PICK',720);
    if(run!==runId)return false;
    setScene('Radar Time · Glow',6);await focusFrame('#timePanel','center');
    await showCaption(fanMode?'여기서 놀던 시간이 쌓이고, 그 시간을 최애에게 보낸다.':'실제 아지트 체류가 Radar Time이 되고 Glow 응원으로 소비됩니다.',fanMode?'RADAR TIME → GLOW':'TIME → SUPPORT',850);
    if(run!==runId)return false;
    const watchTab=frameDoc()?.querySelector('[data-hideout-tab="watch"]');if(watchTab){watchTab.click();await wait(220)}
    await focusFrame('#watchTogether','start');
    await showCaption(fanMode?'영상도 같이 보고, “0:43 여기 봐”를 그 초에 남긴다.':'영상 핀과 타임스탬프 수다가 콘텐츠 소비를 공동 기록으로 바꿉니다.',fanMode?'같이보기 · 장면 수다':'VIDEO PIN · TIMESTAMP',850);
    return run===runId;
  }
  async function latestPulse(){
    if(!api)return null;try{const r=await fetch(api+'/api/v1/community/broadcasts?latest=1',{headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)return null;const d=await r.json();return (d.items||[])[0]||null}catch{return null}
  }
  async function showCommunityVisibility(run,fanMode){
    setScene('팬덤 온도 · 전광판 · Live Pulse',7);
    await loadFrame('index.html#fanHeat','#fanHeat');await focusFrame('#fanHeat','center');
    await showCaption(fanMode?'어느 아지트가 지금 제일 시끄러운지도 보이고.':'팬덤 온도는 Momentum과 분리된 실제 팬 활동 신호입니다.',fanMode?'FAN ROOMS THIS WEEK':'FANDOM TEMPERATURE',700);
    if(run!==runId)return false;
    await focusFrame('#fanBillboard','center');await wait(480);
    await showCaption(fanMode?'마음껏 놀다 보면 팬도 전광판에 뜬다.':'팬 전광판은 Watch·아지트·탑꾸 활동을 팬 정체성과 인정으로 돌려줍니다.',fanMode?'FAN BILLBOARD':'FAN RECOGNITION',760);
    if(run!==runId)return false;
    const doc=frameDoc();if(doc){
      if(!doc.querySelector('link[data-video-live-pulse]')){const l=doc.createElement('link');l.rel='stylesheet';l.href='live-pulse.css';l.dataset.videoLivePulse='1';doc.head.appendChild(l)}
      doc.querySelector('.live-pulse-root[data-video-demo]')?.remove();
      const item=await latestPulse(),icons={'topkku-published':'🎀','topkku-taste-milestone':'♡','topkku-comment-milestone':'💬','gift-arrived':'🎁','room-video-added':'📼','glow-burst':'✦'};
      const pulse=doc.createElement('aside');pulse.className='live-pulse-root is-visible importance-2';pulse.dataset.videoDemo='1';
      const title=item?.title||'새 팬 활동이 생겼어요';const body=item?.body||'탑꾸 · 선물 · Glow 같은 의미 있는 활동이 여기 바로 보여요.';
      pulse.innerHTML='<div class="live-pulse-card"><span class="live-pulse-dot"></span><div class="live-pulse-icon">'+(icons[item?.kind]||'✦')+'</div><div class="live-pulse-copy"><small>지금 IDOL에서</small><b>'+escHtml(title)+'</b><span>'+escHtml(body)+'</span></div></div>';
      doc.body.appendChild(pulse);await wait(260);
    }
    await showCaption(fanMode?'탑꾸, 선물, Glow 같은 일이 지금 바로 떠오르고.':'Live Pulse가 의미 있는 공개 활동을 제품 전체에 다시 순환시킵니다.',fanMode?'LIVE PULSE':'CROSS-FEATURE PULSE',780);
    return run===runId;
  }
  async function showHallEnding(run,fanMode){
    setScene('Hall of Fame · 졸업 기록',9);
    await loadFrame('hall-of-fame.html','.hall-hero');await focusFrame('.hall-hero','center');
    await showCaption(fanMode?'그리고 진짜 커져도, 우리가 먼저 좋아했던 기록은 안 사라진다.':'Radar를 졸업한 팀도 초기 발견과 성장 기록을 Hall of Fame에 보존합니다.',fanMode?'우리만 알던 시절 → 기록':'GRADUATION ARCHIVE',1250);
    await wait(420);return run===runId;
  }

  async function showGrowthRewardDemo(run,fanMode){
    const doc=frameDoc(),root=doc?.querySelector('#growthKeepsakeLayer');if(!root||run!==runId)return false;
    setScene('성장 편지 · 새 꾸미기 해금',8);
    root.hidden=false;
    root.innerHTML='<div class="keepsake-backdrop"><section class="growth-keepsake" role="dialog" aria-modal="true"><button class="keepsake-envelope" type="button" id="videoGrowthEnvelope"><span class="envelope-flap"></span><span class="envelope-seal">♡</span><b>당신에게 온 편지가 있어요</b><small>눌러서 열어보기</small></button><div class="growth-letter" id="videoGrowthLetter" hidden><div class="letter-tape"></div><span class="letter-kicker">FROM IDOL</span><h2>우리방 단골이 되었어요 ♡</h2><p>좋아하는 순간을 오래 모아온 당신에게 새 꾸미기 서랍을 열어둘게요.</p><div class="letter-sign">덕질 결 · 원석 탐험가 · 꾸미기 장인</div><div class="letter-sign">— IDOL · FOR MY IDOL ♡</div><div class="keepsake-benefits"><b>이번에 같이 온 것들</b><div class="keepsake-item-row"><article><img src="assets/topkku/satin-bow-pearl-pink.svg" alt=""><span>새틴 리본</span></article><article><img src="assets/topkku/pearl-chain.svg" alt=""><span>진주 체인</span></article><article><img src="assets/topkku/gem.svg" alt=""><span>샤이닝 젬</span></article></div></div><aside class="next-envelope-peek"><span>조금 더 함께 놀면…</span><b>찐팬</b><small>다음 서랍도 조용히 준비해둘게요.</small></aside></div></section></div>';
    await wait(520);
    const env=doc.querySelector('#videoGrowthEnvelope'),letter=doc.querySelector('#videoGrowthLetter');
    env?.classList.add('opened');await wait(380);if(env)env.hidden=true;if(letter){letter.hidden=false;letter.classList.add('arrive')}
    await showCaption(fanMode?'놀다 보니 편지가 오고, 새 꾸미기가 한꺼번에 열린다.':'활동은 숫자 레벨 대신 편지와 실제 꾸미기 해금으로 돌아옵니다.',fanMode?'성장 편지':'PROGRESSION',1250);
    await wait(760);if(run!==runId)return false;
    setScene('선물꾸러미 · 팬에게서 도착',8);
    root.innerHTML='<div class="keepsake-backdrop"><section class="gift-keepsake" role="dialog" aria-modal="true"><div class="gift-ribbon">FOR YOU</div><span class="letter-kicker">SOMEONE LEFT YOU A GIFT</span><h2>누가 작은 선물을 두고 갔어요 ♡</h2><div class="gift-stack"><article class="received-gift-card"><div class="received-gift-object"><img src="assets/topkku/crystal-heart-chain-pink.svg" alt=""></div><div><b>크리스탈 하트 체인</b><span>같이 덕질하던 팬이 보냈어요</span><p>“이거 네 탑꾸에 진짜 잘 어울릴 것 같아서 ♡”</p><small>이 꾸미기는 이제 내 서랍에 계속 남아요.</small></div></article></div><button class="keepsake-main" type="button">내 서랍에 잘 넣어둘게요 ♡</button></section></div>';
    await showCaption(fanMode?'그리고 진짜 다른 팬한테 선물도 온다.':'팬의 반응이 영구 소장 가능한 꾸미기 선물로 이어집니다.',fanMode?'선물꾸러미':'FAN-TO-FAN GIFT',1320);
    await wait(760);root.hidden=true;root.innerHTML='';return run===runId;
  }
  async function fanStory(run,prepared=false){
    if(!prepared)await loadFrame('index.html#hidden','#hidden');else await focusFrame('#hidden','center');
    setScene('Hidden Gems · 원석 발견',0);await showCaption('아무도 모를 때 발견한 애가 제일 좋다.','HIDDEN GEMS',1250);await wait(360);
    if(!await watchIntoTopkku(run,true))return;
    if(!await decorateTopkku(run,true))return;
    if(!await showTopkkuSocial(run,true))return;
    if(!await showHideoutCore(run,true))return;
    if(!await showCommunityVisibility(run,true))return;
    await loadFrame('topkku.html?from=video-studio-reward','#growthKeepsakeLayer');await wait(420);
    if(!await showGrowthRewardDemo(run,true))return;
    if(!await showHallEnding(run,true))return;
    setScene('완료 · 발견부터 졸업까지',9);
  }
  async function investorStory(run,prepared=false){
    if(!prepared)await loadFrame('index.html#radar','#radar');else await focusFrame('#radar','center');
    setScene('Radar · 발견',0);await showCaption('메이저가 된 뒤가 아니라, 발견 이전부터 팬 여정을 시작합니다.','01 · DISCOVERY',1200);await wait(320);
    await focusFrame('#hidden','center');await showCaption('작은 팀의 변화와 발견 경험을 제품 전면에 둡니다.','DISCOVERY SURFACE',900);await wait(260);
    if(!await watchIntoTopkku(run,false))return;
    if(!await decorateTopkku(run,false))return;
    if(!await showTopkkuSocial(run,false))return;
    if(!await showHideoutCore(run,false))return;
    if(!await showCommunityVisibility(run,false))return;
    await loadFrame('topkku.html?from=video-studio-reward','#growthKeepsakeLayer');await wait(420);
    if(!await showGrowthRewardDemo(run,false))return;
    if(!await showHallEnding(run,false))return;
    await showCaption('발견 → 시청 → 창작 → Pick → 체류/응원 → 관계 → 성장 → 기록','IDOL LOOP',1500);
    setScene('완료 · 전체 제품 루프',9);
  }
  async function prepareFirstFrame(){
    await resolveSource();
    const url=selectedStory==='fan'?'index.html#hidden':'index.html#radar',target=selectedStory==='fan'?'#hidden':'#radar';
    await loadFrame(url,target);await focusFrame(target,'center');caption.classList.remove('show','leave');await wait(760);
  }
  async function runStory(prepared=false){
    if(running)return;
    running=true;const run=++runId;document.querySelectorAll('[data-story]').forEach(b=>b.disabled=true);
    setStatus('실제 웹 화면 자동조작 중…');
    try{
      await resolveSource();
      if(selectedStory==='fan')await fanStory(run,prepared);else await investorStory(run,prepared);
    }catch(err){console.error('TOPKKU_VIDEO_STORY_FAILED',err);setStatus('자동조작 중 문제가 생겼습니다. 현재 화면과 콘솔 로그를 확인하세요.')}
    finally{
      if(run===runId){
        running=false;document.querySelectorAll('[data-story]').forEach(b=>b.disabled=false);
        if(recorder&&recorder.state!=='inactive')recorder.stop();else setStatus('미리보기 완료 · 장면 흐름을 확인했습니다.');
      }
    }
  }
  function stopStream(){if(recordStream){recordStream.getTracks().forEach(t=>t.stop());recordStream=null}}
  function resetRun(){
    runId++;running=false;document.querySelectorAll('[data-story]').forEach(b=>b.disabled=false);
    caption.classList.remove('show','leave');touch.classList.remove('active');setScene('중지됨');
  }
  function stopRecording(){
    resetRun();if(safetyTimer){clearTimeout(safetyTimer);safetyTimer=null}
    if(recorder&&recorder.state!=='inactive')recorder.stop();else{stopStream();document.documentElement.classList.remove('video-window-recording');setStatus('중지했습니다.')}
  }
  function fitCaptureWindow(){
    if(!captureWindow)return;
    const dx=450-window.innerWidth,dy=800-window.innerHeight;
    if(Math.abs(dx)>2||Math.abs(dy)>2){try{window.resizeBy(dx,dy)}catch{}}
  }
  function recordingFileName(){return 'topkku-'+selectedStory+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.webm'}
  async function saveLastRecording(){
    if(!lastRecordingBlob){setStatus('저장할 촬영 영상이 없습니다.');return false}
    const name=recordingFileName();
    if(typeof window.showSaveFilePicker==='function'){
      try{
        const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'WebM video',accept:{'video/webm':['.webm']}}]});
        const writable=await handle.createWritable();await writable.write(lastRecordingBlob);await writable.close();
        if(captureResult){captureResult.hidden=false;captureResult.classList.add('saved');captureResult.textContent='파일 저장 완료 · 필요하면 아래 버튼으로 다시 저장할 수 있어요.'}
        setStatus('파일 저장 완료 · 선택한 위치에 WebM을 썼습니다.');return true
      }catch(err){
        if(err?.name==='AbortError'){setStatus('영상 저장을 취소했습니다. 촬영본은 이 창에 그대로 남아 있습니다.');return false}
        console.warn('TOPKKU_VIDEO_FILE_PICKER_FAILED',err)
      }
    }
    const a=document.createElement('a');a.href=downloadUrl||URL.createObjectURL(lastRecordingBlob);a.download=name;document.body.appendChild(a);a.click();a.remove();
    if(captureResult){captureResult.hidden=false;captureResult.classList.add('saved');captureResult.textContent='브라우저 다운로드를 시작했습니다. 다운로드 목록에서 파일을 확인하세요.'}
    setStatus('브라우저 다운로드를 시작했습니다.');return true
  }

  async function startRecording(){
    if(recorder||running)return;
    lastRecordingBlob=null;if(captureSave)captureSave.hidden=true;if(captureResult){captureResult.hidden=true;captureResult.classList.remove('saved');captureResult.textContent=''};
    if(!navigator.mediaDevices?.getDisplayMedia||!('MediaRecorder'in window)){setStatus('이 브라우저는 현재 탭 자동촬영을 지원하지 않습니다. 미리보기만 사용할 수 있습니다.');return}
    try{
      setStatus('화면 공유에서 현재 탭을 선택하세요.');
      recordStream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:false,preferCurrentTab:true,selfBrowserSurface:'include'});
      const [videoTrack]=recordStream.getVideoTracks();let cropped=false;
      if(window.CropTarget?.fromElement&&videoTrack&&typeof videoTrack.cropTo==='function'){
        try{const target=await CropTarget.fromElement(viewport);await videoTrack.cropTo(target);cropped=true}catch(err){console.warn('TOPKKU_VIDEO_REGION_CROP_FAILED',err)}
      }
      if(!cropped&&!captureWindow){
        stopStream();setStatus('세로 영역 크롭을 시작하지 못했습니다. “세로 촬영창 열기”에서 다시 시작하세요.');return;
      }
      if(videoTrack&&'contentHint'in videoTrack){try{videoTrack.contentHint='detail'}catch{}}
      if(captureWindow){document.documentElement.classList.add('video-window-recording');fitCaptureWindow();await wait(260)}
      await prepareFirstFrame();
      const types=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'],mime=types.find(x=>MediaRecorder.isTypeSupported?.(x))||'';
      chunks=[];recorder=mime?new MediaRecorder(recordStream,{mimeType:mime,videoBitsPerSecond:5000000}):new MediaRecorder(recordStream,{videoBitsPerSecond:5000000});
      recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
      recorder.onstop=()=>{
        if(safetyTimer){clearTimeout(safetyTimer);safetyTimer=null}
        if(downloadUrl)URL.revokeObjectURL(downloadUrl);
        const blob=new Blob(chunks,{type:recorder?.mimeType||'video/webm'});lastRecordingBlob=blob;downloadUrl=URL.createObjectURL(blob);
        const filename=recordingFileName();if(download){download.href=downloadUrl;download.download=filename;download.hidden=false}
        recorder=null;stopStream();document.documentElement.classList.remove('video-window-recording');
        if(captureWindow){
          $('#captureWindowGate').hidden=false;if(captureSave)captureSave.hidden=false;
          if(captureResult){captureResult.hidden=false;captureResult.classList.remove('saved');captureResult.textContent='촬영 완료 · 아래 “촬영 영상 저장”을 눌러 파일 위치를 선택하세요.'}
          setStatus('촬영 완료 · 촬영창의 저장 버튼으로 파일을 저장하세요.');
        }else setStatus('촬영 완료 · WebM 저장 버튼이 열렸습니다.');
      };
      recorder.start(500);setStatus('REC · 실제 웹빌드를 자동조작하고 있습니다.');
      safetyTimer=setTimeout(()=>{if(recorder&&recorder.state!=='inactive')stopRecording()},105000);
      setTimeout(()=>runStory(true),120);
    }catch(err){
      console.warn('TOPKKU_VIDEO_CAPTURE_CANCELLED',err);stopStream();document.documentElement.classList.remove('video-window-recording');setStatus('화면 공유가 취소되었습니다. 현재 탭을 선택하면 자동촬영을 시작할 수 있습니다.');
    }
  }

  document.querySelectorAll('[data-story]').forEach(b=>b.addEventListener('click',()=>{if(running)return;selectedStory=b.dataset.story==='investor'?'investor':'fan';source=null;renderStory();prepareFirstFrame()}));
  $('#videoPreview')?.addEventListener('click',async()=>{if(running)return;await prepareFirstFrame();runStory(true)});
  $('#videoRecord')?.addEventListener('click',startRecording);
  $('#videoStop')?.addEventListener('click',stopRecording);
  $('#videoCaptureWindow')?.addEventListener('click',()=>{const url='topkku-video.html?capture=1&story='+encodeURIComponent(selectedStory);window.open(url,'topkku-video-capture','popup,width=520,height=920,resizable=yes,scrollbars=no')});
  $('#captureWindowStart')?.addEventListener('click',async()=>{$('#captureWindowGate').hidden=true;fitCaptureWindow();await wait(120);startRecording()});
  $('#captureWindowSave')?.addEventListener('click',saveLastRecording);
  $('#captureWindowClose')?.addEventListener('click',()=>window.close());
  if(captureWindow){document.documentElement.classList.add('video-capture-window');$('#captureWindowGate').hidden=false;setTimeout(fitCaptureWindow,120)}
  renderStory();prepareFirstFrame();
})();

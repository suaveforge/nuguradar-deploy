(()=>{
  const $=s=>document.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const params=new URLSearchParams(location.search);
  const captureWindow=params.get('capture')==='1';
  const frame=$('#videoFrame'),viewport=$('#videoViewport'),caption=$('#videoCaption'),touch=$('#videoTouch');
  const status=$('#videoStatus'),sceneState=$('#sceneState'),download=$('#videoDownload');
  const api=String((window.NUGU_CONFIG||{}).apiBase||'').replace(/\/$/,'');
  const STORY_INFO={
    fan:{
      kicker:'FAN FILM · 약 48초',
      title:'우리만 알던 애를, 우리만의 방식으로 남긴다.',
      desc:'원석을 발견해 영상을 미친 듯이 넘기다가 한 장면에서 멈추고, 킬러 탑꾸·성장 편지·선물꾸러미까지 이어지는 실제 덕질 흐름입니다.',
      steps:['원석을 먼저 발견','Watch를 계속 넘기기','꽂힌 장면 → 탑꾸','킬러 탑꾸 만들기','성장 편지 열기','선물꾸러미 받기','다른 팬 취향과 연결','우리만 알던 시절을 기록']
    },
    investor:{
      kicker:'INVESTOR FILM · 약 55초',
      title:'발견이 시청에서 끝나지 않고, 창작과 보상과 관계로 이어진다.',
      desc:'발견·연속 시청·UGC·고품질 팬콘텐츠·성장 보상·팬간 선물·소셜 관계·재방문까지 실제 제품 루프로 보여줍니다.',
      steps:['발견 이전 구간 선점','연속 콘텐츠 소비','1클릭 UGC 진입','킬러 팬콘텐츠 확장','성장 보상','팬간 선물','저장·댓글·참고 관계','재방문 루프']
    }
  };
  let selectedStory=params.get('story')==='investor'?'investor':'fan';
  let running=false,runId=0,recorder=null,recordStream=null,chunks=[],downloadUrl='',safetyTimer=null,source=null;

  function setStatus(text){if(status)status.textContent=text}
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
  async function decorateTopkku(run,fanMode){
    setScene('탑꾸 · 보면서 꾸미기',2);
    await showCaption(fanMode?'완성 화면은 계속 보고, 꾸미기 서랍만 움직인다.':'편집 캔버스와 도구를 동시에 유지해 조작 피드백을 즉시 봅니다.',fanMode?'TOPKKU':'EDITOR UX',1100);
    if(run!==runId)return false;
    setScene('킬러 탑꾸 · Blue Stage',3);
    const blue=await tapFrame('#buildBlueStage',620);
    if(blue)await showCaption(fanMode?'한 컷이 블루 스크랩으로 확 바뀌고.':'같은 원본이 완성도 높은 팬콘텐츠로 즉시 확장됩니다.',fanMode?'BLUE STAGE':'KILLER CONTENT',1050);
    if(run!==runId)return false;
    const pink=await tapFrame('#buildPinkLace',650);
    if(pink)await showCaption(fanMode?'이번엔 핑크 레이스. 계속 따라 만들고 싶게.':'스타일 세트가 창작 진입 장벽을 낮추면서 결과물 품질을 끌어올립니다.',fanMode?'PINK LACE':'KILLER CONTENT',1120);
    if(run!==runId)return false;
    if(fanMode){
      const copied=await tapFrame('[data-copy="우리만 알던 시절"]',380);
      if(copied)await showCaption('우리만 알던 시절 ♡','SAY IT',820);
    }
    return run===runId;
  }

  async function showGrowthRewardDemo(run,fanMode){
    const doc=frameDoc(),root=doc?.querySelector('#growthKeepsakeLayer');if(!root||run!==runId)return false;
    setScene('성장 편지 · 새 꾸미기 해금',4);
    root.hidden=false;
    root.innerHTML='<div class="keepsake-backdrop"><section class="growth-keepsake" role="dialog" aria-modal="true"><button class="keepsake-envelope" type="button" id="videoGrowthEnvelope"><span class="envelope-flap"></span><span class="envelope-seal">♡</span><b>당신에게 온 편지가 있어요</b><small>눌러서 열어보기</small></button><div class="growth-letter" id="videoGrowthLetter" hidden><div class="letter-tape"></div><span class="letter-kicker">FROM IDOL</span><h2>우리방 단골이 되었어요 ♡</h2><p>좋아하는 순간을 오래 모아온 당신에게 새 꾸미기 서랍을 열어둘게요.</p><div class="letter-sign">— IDOL · FOR MY IDOL ♡</div><div class="keepsake-benefits"><b>이번에 같이 온 것들</b><div class="keepsake-item-row"><article><img src="assets/topkku/satin-bow-pearl-pink.svg" alt=""><span>새틴 리본</span></article><article><img src="assets/topkku/pearl-chain.svg" alt=""><span>진주 체인</span></article><article><img src="assets/topkku/gem.svg" alt=""><span>샤이닝 젬</span></article></div></div><aside class="next-envelope-peek"><span>조금 더 함께 놀면…</span><b>찐팬</b><small>다음 서랍도 조용히 준비해둘게요.</small></aside></div></section></div>';
    await wait(520);
    const env=doc.querySelector('#videoGrowthEnvelope'),letter=doc.querySelector('#videoGrowthLetter');
    env?.classList.add('opened');await wait(380);if(env)env.hidden=true;if(letter){letter.hidden=false;letter.classList.add('arrive')}
    await showCaption(fanMode?'놀다 보니 편지가 오고, 새 꾸미기가 한꺼번에 열린다.':'활동은 숫자 레벨 대신 편지와 실제 꾸미기 해금으로 돌아옵니다.',fanMode?'성장 편지':'PROGRESSION',1250);
    await wait(760);if(run!==runId)return false;
    setScene('선물꾸러미 · 팬에게서 도착',5);
    root.innerHTML='<div class="keepsake-backdrop"><section class="gift-keepsake" role="dialog" aria-modal="true"><div class="gift-ribbon">FOR YOU</div><span class="letter-kicker">SOMEONE LEFT YOU A GIFT</span><h2>누가 작은 선물을 두고 갔어요 ♡</h2><div class="gift-stack"><article class="received-gift-card"><div class="received-gift-object"><img src="assets/topkku/crystal-heart-chain-pink.svg" alt=""></div><div><b>크리스탈 하트 체인</b><span>같이 덕질하던 팬이 보냈어요</span><p>“이거 네 탑꾸에 진짜 잘 어울릴 것 같아서 ♡”</p><small>이 꾸미기는 이제 내 서랍에 계속 남아요.</small></div></article></div><button class="keepsake-main" type="button">내 서랍에 잘 넣어둘게요 ♡</button></section></div>';
    await showCaption(fanMode?'그리고 진짜 다른 팬한테 선물도 온다.':'팬의 반응이 영구 소장 가능한 꾸미기 선물로 이어집니다.',fanMode?'선물꾸러미':'FAN-TO-FAN GIFT',1320);
    await wait(760);root.hidden=true;root.innerHTML='';return run===runId;
  }
  async function fanStory(run,prepared=false){
    if(!prepared)await loadFrame('index.html#hidden','#hidden');else await focusFrame('#hidden','center');
    setScene('Hidden Gems · 원석 발견',0);await showCaption('아무도 모를 때 발견한 애가 제일 좋다.','HIDDEN GEMS',1450);await wait(520);
    if(!await watchIntoTopkku(run,true))return;
    if(!await decorateTopkku(run,true))return;
    if(!await showGrowthRewardDemo(run,true))return;
    setScene('탑꾸 구경 · 취향 연결',6);await focusFrame('#topkkuGallery','start');await showCaption('나랑 비슷한 애들이 좋아한 순간도 구경하고.','FANS’ TOPKKU',1200);await wait(460);
    if(run!==runId)return;
    await focusFrame('#topkkuBalance','center');await showCaption('이번 주엔 서로의 탑꾸를 놓고 취향대결도 하고.','WEEKLY TASTE BATTLE',1120);await wait(420);
    await focusFrame('#topkkuMakerTrend','center');await showCaption('유명해지기 전부터 좋아했던 순간이 내 기록으로 쌓인다.','FOR MY IDOL',1450);await wait(620);
    setScene('완료 · 우리만의 기록',7);
  }
  async function investorStory(run,prepared=false){
    if(!prepared)await loadFrame('index.html#radar','#radar');else await focusFrame('#radar','center');
    setScene('Radar · 발견',0);await showCaption('메이저가 된 뒤가 아니라, 발견 이전부터 팬 여정을 시작합니다.','01 · DISCOVERY',1400);await wait(460);
    await focusFrame('#hidden','center');await showCaption('유명도보다 아직 작은 팀의 움직임과 발견 경험을 앞에 둡니다.','DISCOVERY SURFACE',1120);await wait(420);
    if(!await watchIntoTopkku(run,false))return;
    if(!await decorateTopkku(run,false))return;
    if(!await showGrowthRewardDemo(run,false))return;
    setScene('Gallery · 관계',6);await focusFrame('#topkkuGallery','start');await showCaption('저장 · 댓글 · 참고꾸미기가 작품과 팬 사이의 관계를 만듭니다.','SOCIAL GRAPH',1250);await wait(460);
    if(run!==runId)return;
    await focusFrame('#topkkuMakerTrend','center');await showCaption('반응은 메이커 정체성과 다음 방문의 이유로 누적됩니다.','MAKER IDENTITY',1180);await wait(420);
    await focusFrame('#topkkuVault','center');await showCaption('소비가 소장과 정리와 재방문으로 바뀝니다.','RETENTION',1100);await wait(420);
    await showCaption('발견 → 연속시청 → 창작 → 보상 → 관계 → 재방문','IDOL LOOP',1750);setScene('완료 · 제품 루프',7);
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
  async function startRecording(){
    if(recorder||running)return;
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
        const blob=new Blob(chunks,{type:recorder?.mimeType||'video/webm'});downloadUrl=URL.createObjectURL(blob);
        if(download){download.href=downloadUrl;download.download='topkku-'+selectedStory+'-'+new Date().toISOString().slice(0,10)+'.webm';download.hidden=false}
        recorder=null;stopStream();document.documentElement.classList.remove('video-window-recording');setStatus('촬영 완료 · WebM 저장 버튼이 열렸습니다.');
        if(captureWindow){$('#captureWindowGate').hidden=false;renderStory()}
      };
      recorder.start(500);setStatus('REC · 실제 웹빌드를 자동조작하고 있습니다.');
      safetyTimer=setTimeout(()=>{if(recorder&&recorder.state!=='inactive')stopRecording()},80000);
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
  $('#captureWindowClose')?.addEventListener('click',()=>window.close());
  if(captureWindow){document.documentElement.classList.add('video-capture-window');$('#captureWindowGate').hidden=false;setTimeout(fitCaptureWindow,120)}
  renderStory();prepareFirstFrame();
})();

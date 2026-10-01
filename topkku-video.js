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
      kicker:'FAN FILM · 약 35초',
      title:'우리만 알던 애를, 우리만의 방식으로 남긴다.',
      desc:'기능 설명 대신 감정이 먼저 움직이고, 그 감정이 실제 제품 행동으로 이어지는 흐름입니다.',
      steps:['원석을 먼저 발견','Watch에서 꽂힌 한 장면','1클릭으로 탑꾸 이동','내 취향대로 꾸미기','다른 팬의 취향 구경','우리만 알던 시절을 기록']
    },
    investor:{
      kicker:'INVESTOR FILM · 약 42초',
      title:'발견이 시청에서 끝나지 않고, 창작과 관계로 이어진다.',
      desc:'IDOL의 핵심 루프를 실제 화면으로 보여줍니다. 발견·공식 콘텐츠·UGC·소셜 신호·재방문이 하나의 흐름으로 연결됩니다.',
      steps:['발견 이전 구간 선점','공식 콘텐츠 소비','1클릭 UGC 진입','팬마다 다른 2차 창작','저장·댓글·참고 관계','메이커 정체성과 재방문']
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
  async function tapFrame(selector,after=420){
    const el=await focusFrame(selector);if(!el)return false;
    const r=el.getBoundingClientRect();touch.style.left=(r.left+r.width/2)+'px';touch.style.top=(r.top+r.height/2)+'px';
    touch.classList.remove('active');void touch.offsetWidth;touch.classList.add('active');await wait(120);
    try{el.click()}catch{return false}
    await wait(after);return true;
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
    await showCaption(fanMode?'근데 영상 보다가, 이 표정이 와버림.':'발견은 바로 공식 콘텐츠 소비로 이어집니다.',fanMode?'WATCH · 꽂힌 순간':'WATCH · OFFICIAL CONTENT',1550);
    await wait(1350);
    if(run!==runId)return false;
    const clicked=await tapFrame('.reel-topkku',120);
    if(clicked)await showCaption(fanMode?'그 순간 그대로, 탑꾸.':'재생 중 1클릭 → 정확한 프레임 → UGC 시작.',fanMode?'ONE TAP':'ONE-CLICK UGC',1250);
    let reached=clicked?await waitFramePath('topkku.html',32000):false;
    if(!reached){setScene('정식 프레임 경로 재시도',2);reached=await canonicalHandoff()}
    if(!reached)return false;
    await waitFrame('#topkkuCanvas',10000);await waitSelection(10000);await focusFrame('.topkku-stage-wrap','center');await wait(350);
    return run===runId;
  }
  async function decorateTopkku(run,fanMode){
    setScene('탑꾸 · 실제 편집기',2);
    await showCaption(fanMode?'방금 그 표정이 진짜 편집기로 들어왔다.':'Watch 프레임이 그대로 실제 편집기의 원재료가 됩니다.',fanMode?'TOPKKU':'EDITOR',1200);
    if(run!==runId)return false;
    const pink=await tapFrame('#buildPinkLace',850);
    if(pink){await focusFrame('.topkku-stage-wrap','center');await showCaption(fanMode?'내가 좋아한 방식으로, 미친 듯이 꾸미고.':'같은 원본이 팬마다 다른 2차 창작물로 바뀝니다.',fanMode?'MY TASTE':'UGC VARIATION',1450)}
    if(run!==runId)return false;
    if(fanMode){
      const copied=await tapFrame('[data-copy="우리만 알던 시절"]',480);
      if(copied){await focusFrame('.topkku-stage-wrap','center');await showCaption('우리만 알던 시절 ♡','SAY IT',1050)}
    }
    return run===runId;
  }
  async function fanStory(run,prepared=false){
    if(!prepared)await loadFrame('index.html#hidden','#hidden');else await focusFrame('#hidden','center');
    setScene('Hidden Gems · 원석 발견',0);await showCaption('아무도 모를 때 발견한 애가 제일 좋다.','HIDDEN GEMS',1750);await wait(1050);
    if(!await watchIntoTopkku(run,true))return;
    if(!await decorateTopkku(run,true))return;
    setScene('탑꾸 구경 · 취향 연결',4);await focusFrame('#topkkuGallery','start');await showCaption('나랑 비슷한 애들이 좋아한 순간도 구경하고.','FANS’ TOPKKU',1550);await wait(700);
    if(run!==runId)return;
    await focusFrame('#topkkuMakerTrend','center');await showCaption('유명해지기 전부터 좋아했던 순간이 쌓인다.','FOR MY IDOL',1750);await wait(850);
    setScene('완료 · 우리만의 기록',5);
  }
  async function investorStory(run,prepared=false){
    if(!prepared)await loadFrame('index.html#radar','#radar');else await focusFrame('#radar','center');
    setScene('Radar · 발견',0);await showCaption('메이저가 된 뒤가 아니라, 발견 이전부터 팬 여정을 시작합니다.','01 · DISCOVERY',1700);await wait(650);
    await focusFrame('#hidden','center');await showCaption('유명도보다 아직 작은 팀의 움직임과 발견 경험을 앞에 둡니다.','DISCOVERY SURFACE',1450);await wait(550);
    if(!await watchIntoTopkku(run,false))return;
    if(!await decorateTopkku(run,false))return;
    setScene('Gallery · 관계',4);await focusFrame('#topkkuGallery','start');await showCaption('저장 · 댓글 · 참고꾸미기가 작품과 팬 사이의 관계를 만듭니다.','SOCIAL GRAPH',1600);await wait(650);
    if(run!==runId)return;
    await focusFrame('#topkkuMakerTrend','center');await showCaption('반응은 메이커의 취향 정체성과 다시 찾을 이유로 누적됩니다.','MAKER IDENTITY',1500);await wait(550);
    await focusFrame('#topkkuVault','center');await showCaption('소비가 끝나는 게 아니라, 소장과 정리와 재방문으로 바뀝니다.','RETENTION',1500);await wait(600);
    await showCaption('발견 → 시청 → 창작 → 관계 → 재방문','IDOL LOOP',2100);setScene('완료 · 제품 루프',5);
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

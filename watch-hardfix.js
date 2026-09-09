(()=>{
  const dlg=document.getElementById('watchPlayer');
  const body=document.getElementById('playerBody');
  let lockedY=0;

  function lockDocument(){
    if(document.body.dataset.nuguHardLocked==='1')return;
    lockedY=window.scrollY||0;
    document.body.dataset.nuguHardLocked='1';
    document.documentElement.style.overflow='hidden';
    document.body.style.position='fixed';
    document.body.style.top=`-${lockedY}px`;
    document.body.style.left='0';
    document.body.style.right='0';
    document.body.style.width='100%';
    document.body.style.overflow='hidden';
  }
  function unlockDocument(){
    if(document.body.dataset.nuguHardLocked!=='1')return;
    delete document.body.dataset.nuguHardLocked;
    document.documentElement.style.overflow='';
    document.body.style.position='';
    document.body.style.top='';
    document.body.style.left='';
    document.body.style.right='';
    document.body.style.width='';
    document.body.style.overflow='';
    window.scrollTo(0,lockedY);
  }
  window.addEventListener('nugu-watch-opened',()=>requestAnimationFrame(lockDocument));
  dlg?.addEventListener('close',unlockDocument);

  const iframe=()=>body?.querySelector('.player-frame iframe');
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  function sendYT(func,args=[]){try{iframe()?.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch{}}
  function parseTime(){
    const s=(body?.querySelector('#frameTopkkuTime')?.textContent||'0:00').trim();
    const m=s.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    return m?Number(m[1])*60+Number(m[2]):0;
  }
  async function streamVideo(stream){
    const v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=stream;
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('capture_timeout')),6000);v.onloadedmetadata=()=>{clearTimeout(t);resolve()};v.onerror=()=>{clearTimeout(t);reject(new Error('capture_video_error'))}});
    await v.play();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return v;
  }
  function cropShorts(video){
    const f=iframe();if(!f)throw new Error('player_missing');
    const r=f.getBoundingClientRect();
    const vw=document.documentElement.clientWidth||innerWidth;
    const vh=document.documentElement.clientHeight||innerHeight;
    const sx=video.videoWidth/vw,sy=video.videoHeight/vh;
    let x=Math.max(0,r.left*sx),y=Math.max(0,r.top*sy),w=Math.min(video.videoWidth-x,r.width*sx),h=Math.min(video.videoHeight-y,r.height*sy);
    if(!(w>100&&h>100))throw new Error('capture_scale');
    const targetW=Math.min(w,h*9/16);
    x+=Math.max(0,(w-targetW)/2);w=targetW;
    const trimTop=h*.008,trimBottom=h*.035;
    y+=trimTop;h-=trimTop+trimBottom;
    const maxSide=1500,scale=Math.min(1,maxSide/Math.max(w,h));
    const out=document.createElement('canvas');out.width=Math.max(1,Math.round(w*scale));out.height=Math.max(1,Math.round(h*scale));
    const c=out.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(video,x,y,w,h,0,0,out.width,out.height);return out;
  }
  const toDataURL=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>{if(!blob)return reject(new Error('encode'));const rd=new FileReader();rd.onload=()=>resolve(String(rd.result||''));rd.onerror=reject;rd.readAsDataURL(blob)},'image/jpeg',.92));

  async function hardCapture(ev){
    const btn=ev.target.closest?.('#frameTopkkuButton');
    if(!btn||!dlg?.classList.contains('is-vertical'))return;
    ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    if(btn.dataset.hardBusy==='1')return;
    btn.dataset.hardBusy='1';
    const state=body?.querySelector('#frameTopkkuState');
    let stream=null;const t=parseTime();
    try{
      if(state)state.textContent='현재 탭을 허용하면 실제 세로 영상 부분만 잘라서 가져올게요.';
      stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false,preferCurrentTab:true,selfBrowserSurface:'include'});
      const track=stream.getVideoTracks()[0];
      if(track?.getSettings?.().displaySurface&&track.getSettings().displaySurface!=='browser')throw new Error('choose_current_tab');
      const v=await streamVideo(stream);
      sendYT('seekTo',[Math.max(0,t-.25),true]);sendYT('playVideo');await wait(700);
      const canvas=cropShorts(v);
      sendYT('pauseVideo');sendYT('seekTo',[t,true]);
      const image=await toDataURL(canvas);
      const title=body?.querySelector('.player-title h2')?.textContent?.trim()||'NUGU RADAR Watch';
      const line=body?.querySelector('.player-title p')?.textContent?.trim()||'';
      const artist=line.split('·')[0]?.trim()||'';
      const contentUrl=body?.querySelector('.player-title a')?.href||'';
      sessionStorage.setItem('nuguTopkkuIncoming',JSON.stringify({version:6,source:'watch',image,artist,title,contentUrl,time:t,capturedAt:new Date().toISOString(),cleanCapture:true,videoOnly:true,captureMode:'shorts-center-9x16'}));
      if(state)state.textContent='영상 부분만 가져왔어요. 탑꾸 Lab으로 이동합니다 ✨';
      location.href='topkku.html?from=watch';
    }catch(err){
      console.warn('hard Shorts capture failed',err);sendYT('pauseVideo');sendYT('seekTo',[t,true]);
      if(state)state.textContent=err?.name==='NotAllowedError'?'캡처를 취소했어요.':err?.message==='choose_current_tab'?'전체 화면이나 창 말고 현재 탭을 선택해 주세요.':'장면을 가져오지 못했어요. 다시 시도해 주세요.';
    }finally{stream?.getTracks?.().forEach(x=>x.stop());delete btn.dataset.hardBusy}
  }
  document.addEventListener('click',hardCapture,true);
})();
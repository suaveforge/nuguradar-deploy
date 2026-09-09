(()=>{
  const player=document.getElementById('watchPlayer');
  const playerBody=document.getElementById('playerBody');
  if(!player||!playerBody)return;
  let lockY=0,locked=false,busy=false;
  const $=(s,r=document)=>r.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const iframe=()=>$('.player-frame iframe',playerBody);
  const frameHost=()=>$('.player-frame',playerBody);
  function sendYT(func,args=[]){const f=iframe();if(!f?.contentWindow)return;try{f.contentWindow.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch{}}
  function timeValue(){const t=($('#frameTopkkuTime',playerBody)?.textContent||'0:00').trim();const p=t.split(':');return Math.max(0,(Number(p[0])||0)*60+(Number(p[1])||0))}
  function timeLabel(s){const n=Math.max(0,Number(s)||0),m=Math.floor(n/60),x=n-m*60;return`${m}:${x.toFixed(1).padStart(4,'0')}`}
  function state(text,type=''){const el=$('#frameTopkkuState',playerBody);if(el){el.textContent=text;el.dataset.state=type}}

  function hardLock(){if(locked)return;locked=true;lockY=window.scrollY||0;document.documentElement.style.overflow='hidden';document.documentElement.style.height='100%';Object.assign(document.body.style,{position:'fixed',top:`-${lockY}px`,left:'0',right:'0',width:'100%',overflow:'hidden'});player.style.overflow='hidden'}
  function hardUnlock(){if(!locked)return;locked=false;document.documentElement.style.overflow='';document.documentElement.style.height='';Object.assign(document.body.style,{position:'',top:'',left:'',right:'',width:'',overflow:''});window.scrollTo(0,lockY)}
  window.addEventListener('nugu-watch-opened',()=>{hardLock();requestAnimationFrame(()=>{player.style.overflow='hidden'})});
  player.addEventListener('close',hardUnlock);

  async function streamVideo(stream){const v=document.createElement('video');v.muted=true;v.playsInline=true;v.srcObject=stream;await new Promise((ok,bad)=>{const id=setTimeout(()=>bad(new Error('capture_timeout')),7000);v.onloadedmetadata=()=>{clearTimeout(id);ok()};v.onerror=()=>{clearTimeout(id);bad(new Error('capture_video_error'))}});await v.play();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return v}
  function snap(v){const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c}
  function crop(src,x,y,w,h,max=1600){x=Math.max(0,Math.round(x));y=Math.max(0,Math.round(y));w=Math.max(1,Math.min(src.width-x,Math.round(w)));h=Math.max(1,Math.min(src.height-y,Math.round(h)));const k=Math.min(1,max/Math.max(w,h)),out=document.createElement('canvas');out.width=Math.max(1,Math.round(w*k));out.height=Math.max(1,Math.round(h*k));const c=out.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(src,x,y,w,h,0,0,out.width,out.height);return out}

  async function cropTrackToIframe(track){
    const Crop=globalThis.CropTarget;
    const el=iframe();
    if(!Crop?.fromElement||typeof track?.cropTo!=='function'||!el)return false;
    try{
      const target=await Crop.fromElement(el);
      await Promise.race([track.cropTo(target),new Promise((_,reject)=>setTimeout(()=>reject(new Error('region_timeout')),1800))]);
      await wait(180);
      return true;
    }catch(e){
      console.warn('Region Capture unavailable; trying strict pixel calibration',e);
      return false;
    }
  }

  const marks=[['tl',[0,255,153]],['tr',[255,0,153]],['bl',[0,153,255]],['br',[255,204,0]]];
  function addMarks(){const h=frameHost();if(!h)return null;h.style.position='relative';$('.nugu-pixel-cal',h)?.remove();const layer=document.createElement('div');layer.className='nugu-pixel-cal';Object.assign(layer.style,{position:'absolute',inset:'0',zIndex:'2147483646',pointerEvents:'none'});for(const [key,rgb] of marks){const m=document.createElement('i');m.dataset.k=key;Object.assign(m.style,{position:'absolute',width:'44px',height:'44px',background:`rgb(${rgb.join(',')})`,boxShadow:'0 0 0 6px #000 inset',border:'4px solid #fff',boxSizing:'border-box'});if(key.includes('t'))m.style.top='0';else m.style.bottom='0';if(key.includes('l'))m.style.left='0';else m.style.right='0';layer.appendChild(m)}h.appendChild(layer);return layer}
  function near(rgb,t){return Math.abs(rgb[0]-t[0])<38&&Math.abs(rgb[1]-t[1])<38&&Math.abs(rgb[2]-t[2])<38}
  function locateColor(data,w,h,target,quadrant){let minX=w,maxX=-1,minY=h,maxY=-1,n=0;const x0=quadrant.includes('l')?0:Math.floor(w*.45),x1=quadrant.includes('l')?Math.ceil(w*.55):w,y0=quadrant.includes('t')?0:Math.floor(h*.35),y1=quadrant.includes('t')?Math.ceil(h*.65):h;for(let y=y0;y<y1;y+=2){for(let x=x0;x<x1;x+=2){const i=(y*w+x)*4;if(near([data[i],data[i+1],data[i+2]],target)){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);n++}}}return n>36?{minX,maxX,minY,maxY,n}:null}
  function pixelRect(full){const ctx=full.getContext('2d',{willReadFrequently:true}),img=ctx.getImageData(0,0,full.width,full.height),hits={};for(const [key,rgb] of marks)hits[key]=locateColor(img.data,full.width,full.height,rgb,key);if(!hits.tl||!hits.tr||!hits.bl||!hits.br)return null;const left=Math.min(hits.tl.minX,hits.bl.minX),right=Math.max(hits.tr.maxX,hits.br.maxX),top=Math.min(hits.tl.minY,hits.tr.minY),bottom=Math.max(hits.bl.maxY,hits.br.maxY);if(right-left<220||bottom-top<220)return null;const ratio=(right-left)/(bottom-top);if(!Number.isFinite(ratio)||ratio<.35||ratio>3.2)return null;return{x:left,y:top,w:right-left+1,h:bottom-top+1}}

  function darkCol(d,w,h,x,y0,y1){let n=0,z=0;for(let y=y0;y<y1;y+=Math.max(1,Math.floor((y1-y0)/130))){const i=(y*w+x)*4,l=(d[i]+d[i+1]+d[i+2])/3;n++;if(l<25)z++}return n?z/n:0}
  function darkRow(d,w,h,y,x0,x1){let n=0,z=0;for(let x=x0;x<x1;x+=Math.max(1,Math.floor((x1-x0)/130))){const i=(y*w+x)*4,l=(d[i]+d[i+1]+d[i+2])/3;n++;if(l<25)z++}return n?z/n:0}
  function trimBars(c){const w=c.width,h=c.height;if(w<200||h<200)return c;const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;let l=0,r=w-1,t=0,b=h-1;const y0=Math.floor(h*.12),y1=Math.floor(h*.88);while(l<w*.43&&darkCol(d,w,h,l,y0,y1)>.9)l+=2;while(r>w*.57&&darkCol(d,w,h,r,y0,y1)>.9)r-=2;const x0=Math.max(l,Math.floor(w*.18)),x1=Math.min(r,Math.floor(w*.82));while(t<h*.16&&darkRow(d,w,h,t,x0,x1)>.93)t+=2;while(b>h*.84&&darkRow(d,w,h,b,x0,x1)>.93)b-=2;if(r-l<w*.4||b-t<h*.5)return c;return crop(c,l,t,r-l+1,b-t+1)}
  function trimProgress(c){const w=c.width,h=c.height,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;let best=-1,bestRatio=0;for(let y=Math.floor(h*.86);y<h;y+=2){let red=0,n=0;for(let x=0;x<w;x+=3){const i=(y*w+x)*4,R=d[i],G=d[i+1],B=d[i+2];n++;if(R>145&&R>G*1.45&&R>B*1.45)red++}const q=n?red/n:0;if(q>bestRatio){bestRatio=q;best=y}}return bestRatio>.045&&best>h*.86?crop(c,0,0,w,Math.max(1,best-4)):c}
  function trimEdgeText(c){const w=c.width,h=c.height;if(w<240||h<320)return c;const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;let noisy=0,first=h;for(let y=Math.floor(h*.88);y<h;y+=2){let e=0,n=0;for(let x=Math.floor(w*.03)+2;x<Math.floor(w*.82);x+=3){const i=(y*w+x)*4,j=(y*w+x-2)*4,l=(d[i]+d[i+1]+d[i+2])/3,p=(d[j]+d[j+1]+d[j+2])/3;n++;if(Math.abs(l-p)>78&&Math.max(d[i],d[i+1],d[i+2])>160)e++}if(n&&e/n>.06){noisy++;first=Math.min(first,y)}}if(noisy<3||first>h*.975)return c;return crop(c,0,0,w,Math.max(1,first-3))}
  const dataUrl=(c,q=.92)=>new Promise((ok,bad)=>c.toBlob(b=>{if(!b)return bad(new Error('encode'));const r=new FileReader;r.onload=()=>ok(String(r.result||''));r.onerror=()=>bad(new Error('encode'));r.readAsDataURL(b)},'image/jpeg',q));
  async function save(c,meta){const payload={version:8,source:'watch',image:await dataUrl(c),artist:meta.artist,title:meta.title,contentUrl:meta.url,time:meta.time,capturedAt:new Date().toISOString(),cleanCapture:true,videoOnly:true,captureMode:meta.mode,width:c.width,height:c.height};try{sessionStorage.setItem('nuguTopkkuIncoming',JSON.stringify(payload))}catch{const k=Math.min(1,900/Math.max(c.width,c.height)),d=document.createElement('canvas');d.width=Math.round(c.width*k);d.height=Math.round(c.height*k);d.getContext('2d').drawImage(c,0,0,d.width,d.height);payload.image=await dataUrl(d,.82);payload.width=d.width;payload.height=d.height;sessionStorage.setItem('nuguTopkkuIncoming',JSON.stringify(payload))}}

  async function capture(){if(busy)return;busy=true;const buttons=[...playerBody.querySelectorAll('.frame-topkku-action button')];buttons.forEach(b=>b.disabled=true);const target=timeValue(),title=$('.player-title h2',playerBody)?.textContent?.trim()||'NUGU RADAR Watch',meta=$('.player-title p',playerBody)?.textContent?.trim()||'',artist=meta.split('·')[0]?.trim()||'',url=$('.player-title a',playerBody)?.href||'';let stream=null,layer=null;try{if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('unsupported');state(`${timeLabel(target)} 장면의 실제 영상만 찾는 중이에요. “현재 탭”을 허용해 주세요.`,'working');stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false,preferCurrentTab:true,selfBrowserSurface:'include'});const track=stream.getVideoTracks()[0];if(track?.getSettings?.().displaySurface&&track.getSettings().displaySurface!=='browser')throw new Error('choose_tab');let mode='region';const region=await cropTrackToIframe(track);let v=await streamVideo(stream);let out=null;if(region){sendYT('playVideo');await wait(2100);sendYT('seekTo',[target,true]);await wait(220);out=snap(v);}else{mode='pixel-frame';layer=addMarks();if(!layer)throw new Error('frame_not_found');await wait(320);const calibration=snap(v),rect=pixelRect(calibration);layer.remove();layer=null;if(!rect)throw new Error('frame_detection_failed');await wait(140);sendYT('playVideo');await wait(2100);sendYT('seekTo',[target,true]);await wait(220);const live=snap(v);out=crop(live,rect.x,rect.y,rect.w,rect.h);}sendYT('pauseVideo');sendYT('seekTo',[target,true]);out=trimBars(out);out=trimProgress(out);out=trimEdgeText(out);if(out.width<180||out.height<240)throw new Error('clean_frame_too_small');await save(out,{artist,title,url,time:target,mode});state(`${timeLabel(target)} 장면에서 실제 영상만 가져왔어요 ✨`,'success');setTimeout(()=>location.href='topkku.html?from=watch',160)}catch(e){console.warn('watch strict capture failed',e);sendYT('pauseVideo');sendYT('seekTo',[target,true]);if(e?.name==='NotAllowedError')state('캡처를 취소했어요.','');else if(e?.message==='choose_tab')state('“현재 탭”을 선택해 주세요.','error');else if(e?.message==='frame_detection_failed')state('영상 영역을 정확히 찾지 못했어요. 잘못 자른 화면은 저장하지 않았어요. 다시 한 번 시도해 주세요.','error');else state('영상만 정확히 가져오지 못했어요. 잘못된 화면은 저장하지 않았어요. 다시 시도해 주세요.','error')}finally{layer?.remove();stream?.getTracks?.().forEach(t=>t.stop());buttons.forEach(b=>b.disabled=false);busy=false}}

  document.addEventListener('click',e=>{const b=e.target.closest?.('#frameTopkkuButton');if(!b)return;e.preventDefault();e.stopImmediatePropagation();capture()},true);
})();

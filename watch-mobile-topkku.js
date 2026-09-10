(()=>{
  const body=document.getElementById('playerBody');
  if(!body)return;
  const canDirectCapture=()=>typeof navigator.mediaDevices?.getDisplayMedia==='function';
  if(canDirectCapture())return;

  const $=(s,r=document)=>r.querySelector(s);
  const setState=(text,state='')=>{
    const el=$('#frameTopkkuState',body);
    if(!el)return;
    if(el.textContent!==text)el.textContent=text;
    if(el.dataset.state!==state)el.dataset.state=state;
  };
  const targetTime=()=>{
    const raw=(($('#frameTopkkuTime',body)?.textContent)||'0:00').trim(),p=raw.split(':').map(Number);
    if(p.length===3)return Math.max(0,(p[0]||0)*3600+(p[1]||0)*60+(p[2]||0));
    return Math.max(0,(p[0]||0)*60+(p[1]||0));
  };
  const meta=()=>{
    const title=$('.player-title h2',body)?.textContent?.trim()||'NUGU RADAR Watch';
    const mt=$('.player-title p',body)?.textContent?.trim()||'';
    const artist=mt.split('·')[0]?.trim()||'';
    const url=$('.player-title a',body)?.href||'';
    return{title,artist,url,time:targetTime()};
  };

  function decorate(){
    const b=$('#frameTopkkuButton',body);
    if(!b||b.dataset.mobileFallback==='1')return;

    // Set the guard before mutating descendants. The MutationObserver watches
    // playerBody, so doing this first prevents the text/state changes below
    // from recursively re-entering decorate() on iOS Safari.
    b.dataset.mobileFallback='1';
    b.textContent='🖼 스크린샷으로 탑꾸';
    b.title='iPhone/iPad에서는 현재 탭 자동 캡처 대신 스크린샷이나 사진을 골라 탑꾸로 이어집니다.';
    setState('iPhone에서는 원하는 장면을 크게 띄워 스크린샷을 찍은 뒤 이 버튼에서 사진을 골라주세요.','mobile');
  }

  function picker(){
    let input=document.getElementById('nuguMobileTopkkuPicker');
    if(input)return input;
    input=document.createElement('input');
    input.id='nuguMobileTopkkuPicker';
    input.type='file';
    input.accept='image/*';
    input.hidden=true;
    document.body.appendChild(input);
    return input;
  }

  function readImage(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('read'));
      reader.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('image'));
        img.onload=()=>resolve(img);
        img.src=String(reader.result||'');
      };
      reader.readAsDataURL(file);
    });
  }

  async function compressedData(file,max=1800){
    const img=await readImage(file),scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(img.naturalWidth*scale));
    c.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const g=c.getContext('2d');
    g.imageSmoothingEnabled=true;
    g.imageSmoothingQuality='high';
    g.drawImage(img,0,0,c.width,c.height);
    const data=await new Promise((resolve,reject)=>c.toBlob(blob=>{
      if(!blob)return reject(new Error('encode'));
      const r=new FileReader();
      r.onerror=()=>reject(new Error('encode'));
      r.onload=()=>resolve(String(r.result||''));
      r.readAsDataURL(blob);
    },'image/jpeg',.92));
    return{data,width:c.width,height:c.height};
  }

  async function usePhoto(file){
    if(!file)return;
    const m=meta();
    setState('사진을 탑꾸에 맞게 준비하고 있어요…','working');
    try{
      const img=await compressedData(file);
      const payload={version:17,source:'watch',image:img.data,artist:m.artist,title:m.title,contentUrl:m.url,time:m.time,capturedAt:new Date().toISOString(),cleanCapture:false,videoOnly:false,strictCapture:false,manualCapture:true,captureMode:'mobile-photo-picker-fallback',width:img.width,height:img.height};
      sessionStorage.setItem('nuguTopkkuIncoming',JSON.stringify(payload));
      setState('사진을 가져왔어요 ✓ 탑꾸로 이동합니다.','success');
      location.href='topkku.html?from=watch-mobile';
    }catch(err){
      console.error('mobile topkku photo fallback failed',err);
      setState('사진을 불러오지 못했어요. 다른 스크린샷이나 사진을 골라주세요.','error');
    }
  }

  const observer=new MutationObserver(()=>{
    // Only touch the DOM when a newly rendered Topkku button still needs
    // mobile decoration. Other player mutations (time labels, state text,
    // iframe changes) are ignored, preventing observer feedback loops.
    if(body.querySelector('#frameTopkkuButton:not([data-mobile-fallback="1"])'))decorate();
  });
  observer.observe(body,{childList:true,subtree:true});
  decorate();

  window.addEventListener('click',e=>{
    const b=e.target.closest?.('#frameTopkkuButton');
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const input=picker();
    input.value='';
    input.onchange=()=>usePhoto(input.files?.[0]);
    setState('스크린샷 또는 사진을 골라주세요. 영상 장면을 크게 띄운 스크린샷이 가장 예쁘게 나와요.','working');
    input.click();
  },true);
})();
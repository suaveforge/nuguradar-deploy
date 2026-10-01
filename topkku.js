(()=>{
  const canvas=document.getElementById('topkkuCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  const DEFAULT_PHOTO_BOX={x:96,y:126,w:528,h:792,r:30};
  const WATCH_PHOTO_BOUNDS={x:48,y:48,w:624,h:984};
  const photoBox={...DEFAULT_PHOTO_BOX};
  const themes={
    lavender:{bg:'#eee9ff',ink:'#57468b',frame:'#b9a8f5',accent:'#ff86bb',paper:'#fffdf8'},
    pink:{bg:'#ffe8f1',ink:'#8a4564',frame:'#ff9dc4',accent:'#ffc55f',paper:'#fffaf7'},
    mint:{bg:'#e7fff5',ink:'#3d7563',frame:'#8fe6c2',accent:'#8da4ff',paper:'#fbfffd'},
    stageblue:{bg:'#e8eef7',ink:'#27476f',frame:'#93a9c7',accent:'#4f78b5',paper:'#fbfcff'},
    midnight:{bg:'#171724',ink:'#f1ecff',frame:'#6d5ba8',accent:'#ff6cac',paper:'#252436'}
  };
  const catalog=window.NUGU_TOPKKU_STICKERS||{items:[],byId:new Map(),limits:{totalObjects:90,motionObjects:6,privateSavesPerDay:30,publicPostsPerDay:10}};
  const shellCatalog=window.NUGU_TOPKKU_SHELLS||{loaders:[],frames:[],backings:[],packages:[],seals:[],defaults:{loaderId:'clear',frameId:'none',backingId:'none',packageId:'none',sealId:'none'}};
  const limits=catalog.limits;
  const BLUE_STAGE={
    main:{x:178,y:154,w:430,h:660,focusX:.50,focusY:.50},
    film:{x:118,y:294,size:194,rotation:-.028},
    pick:{x:353,y:78,size:34,rotation:-.055},
    polaroid:{x:582,y:178,size:176,rotation:.058},
    saved:{x:627,y:430,size:24,rotation:-.045},
    ticket:{x:112,y:683,size:110,rotation:-.052},
    note:{x:120,y:914,size:105,rotation:-.030},
    lowerFace:{x:374,y:940,size:218,aspect:1.48,rotation:-.035,focusX:.50,focusY:.35},
    lowerStage:{x:610,y:948,size:190,aspect:1.13,rotation:.035,focusX:.50,focusY:.56},
    date:{x:360,y:820,size:14,rotation:-.018},
    artistNote:{x:646,y:650,size:24,rotation:-.050}
  };
  const defaultPhotoView=()=>({zoom:1,x:0,y:0});
  let theme='lavender',photo=null,photoView=defaultPhotoView(),elements=[],selected=-1,drag=null,history=[],sourceMeta=null,compositionEventKey='',selectedArtist=null,saveBusy=false,searchTimer=null;
  let shellState={...shellCatalog.defaults};
  let activeStickerPack='all',styleState=null,vaultUsage=null,currentSavedId=null,currentSavedPublished=false,lastSavedEventKey='',referenceSource=null;
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  const assetImages=new Map(),assetPromises=new Map();
  const sceneImages=new Map(),scenePromises=new Map();
  function ensureAsset(item){
    if(!item?.asset)return Promise.resolve(null);
    const cached=assetImages.get(item.asset);
    if(cached?.complete&&cached.naturalWidth)return Promise.resolve(cached);
    if(assetPromises.has(item.asset))return assetPromises.get(item.asset);
    const pending=new Promise((resolve,reject)=>{
      const img=cached||new Image();
      img.decoding='async';
      img.onload=()=>{assetImages.set(item.asset,img);draw();resolve(img)};
      img.onerror=()=>reject(new Error('asset_load_failed'));
      assetImages.set(item.asset,img);
      if(!img.src)img.src=item.asset;
    }).finally(()=>assetPromises.delete(item.asset));
    assetPromises.set(item.asset,pending);
    return pending;
  }
  function preloadStickerAssets(){catalog.items.filter(item=>item.asset).forEach(item=>ensureAsset(item).catch(()=>{}))}
  function ensureSceneImage(src){
    if(!src)return Promise.reject(new Error('scene_image_missing'));
    const cached=sceneImages.get(src);
    if(cached?.complete&&cached.naturalWidth)return Promise.resolve(cached);
    if(scenePromises.has(src))return scenePromises.get(src);
    const pending=new Promise((resolve,reject)=>{
      const img=cached||new Image();img.decoding='async';
      img.onload=()=>{sceneImages.set(src,img);draw();resolve(img)};
      img.onerror=()=>reject(new Error('scene_image_load_failed'));
      sceneImages.set(src,img);if(!img.src)img.src=src;
    }).finally(()=>scenePromises.delete(src));
    scenePromises.set(src,pending);return pending;
  }
  async function blobDataUrl(blob){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('frame_read_failed'));r.readAsDataURL(blob)})}
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const esc=s=>String(s??'').replace(/[&<>'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]));
  const apiBase=()=>String((window.NUGU_CONFIG||{}).apiBase||'').replace(/\/$/,'');
  const timeLabel=s=>{const n=Math.max(0,Math.floor(Number(s)||0)),m=Math.floor(n/60),sec=n%60;return`${m}:${String(sec).padStart(2,'0')}`};
  const itemById=id=>catalog.byId?.get?.(id)||catalog.items.find(x=>x.id===id)||null;
  const shellItem=(group,id)=>shellCatalog[group+'ById']?.get?.(id)||shellCatalog[group]?.find?.(x=>x.id===id)||null;
  function roundedPath(x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
  function heartPath(size){const s=size/100;ctx.beginPath();ctx.moveTo(0,35*s);ctx.bezierCurveTo(-58*s,-4*s,-45*s,-55*s,-10*s,-43*s);ctx.bezierCurveTo(0,-58*s,38*s,-56*s,48*s,-27*s);ctx.bezierCurveTo(62*s,10*s,24*s,35*s,0,55*s);ctx.bezierCurveTo(-24*s,35*s,-62*s,10*s,-48*s,-27*s);ctx.bezierCurveTo(-38*s,-56*s,0,-58*s,10*s,-43*s);ctx.closePath()}
  function starPath(size,points=5){const outer=size*.52,inner=outer*.43;ctx.beginPath();for(let i=0;i<points*2;i++){const r=i%2?inner:outer,a=-Math.PI/2+i*Math.PI/points,x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath()}
  function gradient(stops,x1,y1,x2,y2){const g=ctx.createLinearGradient(x1,y1,x2,y2);for(const [p,col] of stops)g.addColorStop(p,col);return g}
  function resetPhotoBox(){Object.assign(photoBox,DEFAULT_PHOTO_BOX)}
  function fitBoxToSource(img,bounds=WATCH_PHOTO_BOUNDS){
    const sw=Number(img?.naturalWidth||0),sh=Number(img?.naturalHeight||0);
    if(sw<1||sh<1)return{...DEFAULT_PHOTO_BOX};
    const ratio=sw/sh;
    let w=bounds.w,h=w/ratio;
    if(h>bounds.h){h=bounds.h;w=h*ratio}
    w=Math.max(1,Math.min(bounds.w,w));h=Math.max(1,Math.min(bounds.h,h));
    return{
      x:(W-w)/2,
      y:(H-h)/2,
      w,
      h,
      r:Math.min(30,Math.max(18,Math.min(w,h)*.055))
    };
  }
  function configurePhotoBox(img,meta){
    resetPhotoBox();
    if(meta?.source==='watch')Object.assign(photoBox,fitBoxToSource(img));
  }
  function coverImage(img,x,y,w,h){const base=Math.max(w/img.naturalWidth,h/img.naturalHeight),scale=base*photoView.zoom;const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;const maxX=Math.max(0,(dw-w)/2),maxY=Math.max(0,(dh-h)/2);photoView.x=clamp(photoView.x,-maxX,maxX);photoView.y=clamp(photoView.y,-maxY,maxY);ctx.drawImage(img,x+(w-dw)/2+photoView.x,y+(h-dh)/2+photoView.y,dw,dh)}
  function fitWatchImage(img,x,y,w,h){
    if(photoView.zoom===1&&photoView.x===0&&photoView.y===0){ctx.drawImage(img,x,y,w,h);return}
    const fit=Math.min(w/img.naturalWidth,h/img.naturalHeight),scale=fit*photoView.zoom;
    const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale,maxX=Math.max(0,(dw-w)/2),maxY=Math.max(0,(dh-h)/2);
    photoView.x=clamp(photoView.x,-maxX,maxX);photoView.y=clamp(photoView.y,-maxY,maxY);
    ctx.drawImage(img,x+(w-dw)/2+photoView.x,y+(h-dh)/2+photoView.y,dw,dh);
  }
  function drawPhoto(img,x,y,w,h){if(sourceMeta?.source==='watch')fitWatchImage(img,x,y,w,h);else coverImage(img,x,y,w,h)}
  function snapshot(){return{theme,elements:elements.map(e=>({...e,images:Array.isArray(e.images)?[...e.images]:e.images})),photoView:{...photoView},shellState:{...shellState}}}
  function renderUsage(){const root=$('#topkkuLimitLine');if(!root)return;const s=Number(vaultUsage?.savedToday||0),p=Number(vaultUsage?.publishedToday||0),sl=Number(vaultUsage?.saveLimit||limits.privateSavesPerDay),pl=Number(vaultUsage?.publishLimit||limits.publicPostsPerDay);root.textContent=`만들기·PNG 저장 무제한 · 웹 보관 ${s}/${sl} · 아지트 공개 ${p}/${pl} · 모션 장식 작품당 ${limits.motionObjects}개`}
  function renderSaveState(){const a=$('#webSaveBtn'),b=$('#publishBtn');if(a)a.disabled=saveBusy;if(b){b.disabled=saveBusy;b.textContent=currentSavedPublished?'아지트 벽에 붙음 ✓':'아지트 벽에 붙이기 ✦'}renderUsage()}
  function markDirty(){if(currentSavedId!=null){currentSavedId=null;currentSavedPublished=false;if(compositionEventKey===lastSavedEventKey)compositionEventKey=newCompositionKey();renderSaveState()}}
  function saveHistory(){markDirty();history.push(snapshot());if(history.length>30)history.shift()}
  function restore(s){if(!s)return;markDirty();theme=s.theme;elements=s.elements.map(e=>({...e}));photoView=s.photoView?{...s.photoView}:defaultPhotoView();shellState=s.shellState?{...shellCatalog.defaults,...s.shellState}:{...shellCatalog.defaults};selected=-1;$$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===theme));renderShellControls();draw()}
  function guide(message){const root=$('#stickerGuide');if(root)root.textContent=message}
  function itemCount(id){return elements.filter(e=>e.type==='sticker'&&e.stickerId===id).length}
  function motionCount(){return elements.filter(e=>e.type==='sticker'&&itemById(e.stickerId)?.motion).length}
  function canAddItem(item){if(elements.length>=limits.totalObjects)return{ok:false,msg:`한 작품에는 최대 ${limits.totalObjects}개까지 붙일 수 있어요.`};if(item.motion&&motionCount()>=limits.motionObjects)return{ok:false,msg:`움직이는 장식은 한 작품에 ${limits.motionObjects}개까지 써요.`};if(item.maxPerCanvas&&itemCount(item.id)>=item.maxPerCanvas)return{ok:false,msg:`${item.label}은 한 작품에 ${item.maxPerCanvas}개까지 쓸 수 있어요.`};return{ok:true}}
  function addStickerItem(item){const check=canAddItem(item);if(!check.ok){guide(check.msg);return}saveHistory();const size=Number(item.defaultSize||0)||(item.kind==='frame'?100:item.kind==='tape'?90:item.kind==='lace'?86:76);const y=item.kind==='frame'?photoBox.y+photoBox.h/2:H/2;const value=item.dynamic==='artist'?String(selectedArtist?.name||sourceMeta?.artist||'MY PICK').slice(0,18):item.dynamic==='date'?capturedDateLabel():item.value||'';elements.push({type:'sticker',stickerId:item.id,value,x:W/2,y,size,rotation:0});selected=elements.length-1;guide(`${item.label} 붙였어 ♡`);draw()}
  function addText(value,textStyle='default'){const text=String(value||'').trim();if(!text)return;if(elements.length>=limits.totalObjects){guide(`한 작품에는 최대 ${limits.totalObjects}개 오브젝트까지 붙일 수 있어요.`);return}saveHistory();elements.push({type:'text',value:text,textStyle,x:W/2,y:H-112,size:textStyle==='handwritten'?38:34,rotation:0});selected=elements.length-1;draw();$('#textInput').value=''}
  function elementRadius(e){if(e.type==='scene-filmstrip')return e.size*1.42;if(e.type==='scene-polaroid')return e.size*1.08;if(e.type==='scene-crop')return e.size*.92;if(e.type==='scene-scrap-note')return e.size*1.48;if(e.type==='scene-ticket')return e.size*1.55;if(e.type==='scene-paper-scrap')return e.size*1.15;if(e.type==='scene-tape')return e.size*.95;if(e.type==='scene-chrome')return e.size*.62;if(e.type==='scene-clip')return e.size*.70;if(e.type!=='sticker')return Math.max(e.size*1.1,String(e.value||'').length*e.size*.27);const item=itemById(e.stickerId);if(item?.kind==='frame'&&!item?.asset)return Math.max(photoBox.w,photoBox.h)*.48;return e.size*.75*Number(item?.assetScale||1)}
  function drawBackdrop(t){ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);const g=ctx.createRadialGradient(W*.18,H*.12,20,W*.18,H*.12,420);g.addColorStop(0,t.accent+'55');g.addColorStop(1,t.bg+'00');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle=t.frame;ctx.lineWidth=2;for(let y=30;y<H;y+=46){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y-18);ctx.stroke()}ctx.restore()}
  function drawBackingLayer(){
    const item=shellItem('backings',shellState.backingId);if(!item||item.id==='none'||!item.color)return;
    const x=photoBox.x-42,y=photoBox.y-60,w=photoBox.w+84,h=photoBox.h+120;
    ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-.025);ctx.translate(-W/2,-H/2);
    ctx.shadowColor='rgba(22,24,34,.18)';ctx.shadowBlur=24;ctx.shadowOffsetY=14;roundedPath(x,y,w,h,26);ctx.fillStyle=item.color;ctx.fill();
    ctx.shadowBlur=0;ctx.globalAlpha=.11;ctx.strokeStyle=item.id==='black'?'#fff':'#765f77';ctx.lineWidth=1.2;
    for(let yy=y+24;yy<y+h-18;yy+=34){ctx.beginPath();ctx.moveTo(x+18,yy);ctx.lineTo(x+w-18,yy-8);ctx.stroke()}
    ctx.restore();
  }
  function drawLoaderBase(){
    const item=shellItem('loaders',shellState.loaderId)||{tone:'clear'};
    const tones={clear:['rgba(255,255,255,.12)','rgba(225,236,255,.65)'],frost:['rgba(247,249,255,.34)','rgba(221,227,239,.82)'],pink:['rgba(255,213,229,.22)','rgba(242,151,185,.72)'],blue:['rgba(203,226,255,.22)','rgba(123,176,231,.74)'],black:['rgba(35,38,47,.24)','rgba(72,76,89,.84)']};
    const [fill,stroke]=tones[item.tone]||tones.clear,x=photoBox.x-34,y=photoBox.y-48,w=photoBox.w+68,h=photoBox.h+96;
    ctx.save();ctx.shadowColor='rgba(18,25,42,.22)';ctx.shadowBlur=26;ctx.shadowOffsetY=16;roundedPath(x,y,w,h,32);ctx.fillStyle=fill;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=stroke;ctx.lineWidth=9;ctx.stroke();
    ctx.globalAlpha=.55;ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+24,y+14);ctx.lineTo(x+w-24,y+14);ctx.stroke();
    ctx.globalAlpha=.32;ctx.beginPath();ctx.moveTo(x+14,y+28);ctx.lineTo(x+14,y+h-28);ctx.stroke();ctx.restore();
  }
  function drawDecorativeFrame(){
    const item=shellItem('frames',shellState.frameId);if(!item||item.style==='none')return;
    const x=photoBox.x-16,y=photoBox.y-16,w=photoBox.w+32,h=photoBox.h+32;
    ctx.save();
    if(item.style==='solid'){roundedPath(x,y,w,h,photoBox.r+10);ctx.strokeStyle=item.color;ctx.lineWidth=20;ctx.stroke();ctx.globalAlpha=.32;ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke()}
    else if(item.style==='lace'){
      const c=item.color||'#fffdf8',edge=item.id==='lace-black'?'rgba(255,255,255,.55)':'rgba(170,145,160,.38)';
      ctx.strokeStyle=c;ctx.lineWidth=8;roundedPath(x,y,w,h,photoBox.r+10);ctx.stroke();
      const step=34,lobe=11;
      ctx.lineWidth=5;ctx.strokeStyle=c;ctx.fillStyle='rgba(255,255,255,.10)';
      for(let xx=x+24;xx<x+w-18;xx+=step){
        ctx.beginPath();ctx.arc(xx,y,lobe,Math.PI,0);ctx.stroke();
        ctx.beginPath();ctx.arc(xx,y+h,lobe,0,Math.PI);ctx.stroke();
      }
      for(let yy=y+24;yy<y+h-18;yy+=step){
        ctx.beginPath();ctx.arc(x,yy,lobe,-Math.PI/2,Math.PI/2);ctx.stroke();
        ctx.beginPath();ctx.arc(x+w,yy,lobe,Math.PI/2,Math.PI*1.5);ctx.stroke();
      }
      ctx.globalAlpha=.48;ctx.strokeStyle=edge;ctx.lineWidth=1.6;roundedPath(x-5,y-5,w+10,h+10,photoBox.r+12);ctx.stroke();
      ctx.globalAlpha=.28;ctx.strokeStyle=edge;ctx.lineWidth=1.2;roundedPath(x+6,y+6,w-12,h-12,photoBox.r+7);ctx.stroke();
    }
    ctx.restore();
  }
  function drawPackageOverlay(){
    const item=shellItem('packages',shellState.packageId);if(!item||item.style==='none')return;
    const x=photoBox.x-55,y=photoBox.y-82,w=photoBox.w+110,h=photoBox.h+144;
    ctx.save();roundedPath(x,y,w,h,30);ctx.fillStyle='rgba(255,255,255,.055)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.78)';ctx.lineWidth=4;ctx.stroke();
    ctx.globalAlpha=.38;const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'rgba(255,255,255,.05)');g.addColorStop(.34,'rgba(255,255,255,.62)');g.addColorStop(.42,'rgba(255,255,255,.08)');g.addColorStop(.72,'rgba(255,255,255,.34)');g.addColorStop(1,'rgba(255,255,255,.03)');ctx.fillStyle=g;roundedPath(x+7,y+7,w-14,h-14,25);ctx.fill();ctx.globalAlpha=.65;ctx.strokeStyle='rgba(209,218,232,.8)';ctx.lineWidth=2;ctx.stroke();
    if(item.style==='opp-flap'){ctx.globalAlpha=.60;ctx.fillStyle='rgba(255,255,255,.24)';ctx.beginPath();ctx.moveTo(x+20,y+18);ctx.lineTo(x+w-20,y+18);ctx.lineTo(x+w-68,y+66);ctx.lineTo(x+68,y+66);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(255,255,255,.62)';ctx.stroke()}
    ctx.restore();
  }
  function drawSealOverlay(){
    const item=shellItem('seals',shellState.sealId);if(!item||item.style==='none')return;
    const packageOn=shellState.packageId!=='none',cx=packageOn?photoBox.x+photoBox.w/2:photoBox.x+photoBox.w-20,cy=packageOn?Math.max(42,photoBox.y-48):Math.max(44,photoBox.y-26);
    ctx.save();ctx.translate(cx,cy);ctx.shadowColor='rgba(0,0,0,.18)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;
    if(item.style==='heart'){ctx.fillStyle=item.color;heartPath(74);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=4;ctx.stroke()}
    else if(item.style==='star'){ctx.fillStyle=item.color;starPath(74);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=3;ctx.stroke()}
    else if(item.style==='circle'){ctx.globalAlpha=.38;ctx.fillStyle=item.color;ctx.beginPath();ctx.arc(0,0,24,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.58;ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=2;ctx.stroke()}
    else if(item.style==='label'){ctx.fillStyle='#fffaf1';roundedPath(-62,-25,124,50,9);ctx.fill();ctx.strokeStyle='#d9c9bf';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#5f4a55';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 18px "Segoe Print","Bradley Hand",cursive';ctx.fillText(item.text||'For you ♡',0,1)}
    ctx.restore();
  }
  function renderShellControls(){
    const groups=[['loaders','loaderId','topkkuLoaderOptions'],['frames','frameId','topkkuFrameOptions'],['backings','backingId','topkkuBackingOptions'],['packages','packageId','topkkuPackageOptions'],['seals','sealId','topkkuSealOptions']];
    for(const [group,key,rootId] of groups){const root=$('#'+rootId);if(!root)continue;root.innerHTML=(shellCatalog[group]||[]).map(item=>'<button type="button" class="'+(shellState[key]===item.id?'active':'')+'" data-shell-key="'+key+'" data-shell-id="'+esc(item.id)+'"><span class="shell-dot shell-'+esc(item.id)+'"></span>'+esc(item.label)+'</button>').join('');root.querySelectorAll('[data-shell-id]').forEach(b=>b.onclick=()=>{if(shellState[b.dataset.shellKey]===b.dataset.shellId)return;saveHistory();shellState={...shellState,[b.dataset.shellKey]:b.dataset.shellId};renderShellControls();draw()})}
  }
  function stageNoise(seed){const x=Math.sin(Number(seed||1)*12.9898)*43758.5453;return x-Math.floor(x)}
  function tornPaperPath(x,y,w,h,seed=1,segments=8,amp=7){
    const top=[],right=[],bottom=[],left=[],seg=Math.max(3,segments);
    for(let i=0;i<=seg;i++){const p=i/seg;top.push([x+w*p,y+(stageNoise(seed+i*1.17)-.5)*amp])}
    for(let i=1;i<=seg;i++){const p=i/seg;right.push([x+w+(stageNoise(seed+20+i*1.33)-.5)*amp,y+h*p])}
    for(let i=1;i<=seg;i++){const p=i/seg;bottom.push([x+w*(1-p),y+h+(stageNoise(seed+40+i*1.71)-.5)*amp])}
    for(let i=1;i<seg;i++){const p=i/seg;left.push([x+(stageNoise(seed+60+i*1.91)-.5)*amp,y+h*(1-p)])}
    const pts=[...top,...right,...bottom,...left];
    ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();
  }
  function drawTornPatch(x,y,w,h,color,rotation=0,seed=1,alpha=1){
    ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(rotation);ctx.translate(-x-w/2,-y-h/2);
    tornPaperPath(x,y,w,h,seed,Math.max(5,Math.round(Math.max(w,h)/58)),Math.min(11,Math.max(4,Math.min(w,h)*.08)));
    ctx.shadowColor='rgba(0,0,0,.22)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.save();tornPaperPath(x,y,w,h,seed,Math.max(5,Math.round(Math.max(w,h)/58)),Math.min(11,Math.max(4,Math.min(w,h)*.08)));ctx.clip();
    ctx.globalAlpha=.12;ctx.strokeStyle='#fff';ctx.lineWidth=.8;
    for(let i=0;i<18;i++){const px=x+stageNoise(seed*19+i*3.1)*w,py=y+stageNoise(seed*31+i*5.7)*h,len=5+stageNoise(seed*43+i*7.3)*Math.min(42,w*.22);ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+len,py+(stageNoise(seed*59+i)-.5)*5);ctx.stroke()}
    ctx.globalAlpha=.11;ctx.fillStyle='#05080d';
    for(let i=0;i<26;i++){const px=x+stageNoise(seed*71+i*4.7)*w,py=y+stageNoise(seed*83+i*6.1)*h,r=.45+stageNoise(seed*97+i)*1.45;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill()}
    ctx.restore();ctx.globalAlpha=1;ctx.restore();
  }
  function drawFrame(t){ctx.save();ctx.shadowColor='rgba(0,0,0,.20)';ctx.shadowBlur=28;ctx.shadowOffsetY=18;roundedPath(photoBox.x-24,photoBox.y-24,photoBox.w+48,photoBox.h+48,46);ctx.fillStyle=t.paper;ctx.fill();ctx.restore();ctx.save();roundedPath(photoBox.x,photoBox.y,photoBox.w,photoBox.h,photoBox.r);ctx.clip();if(photo)drawPhoto(photo,photoBox.x,photoBox.y,photoBox.w,photoBox.h);else{ctx.fillStyle=theme==='midnight'?'#313044':'#f4f1f7';ctx.fillRect(photoBox.x,photoBox.y,photoBox.w,photoBox.h);ctx.fillStyle=theme==='midnight'?'#aba5c6':'#90899b';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 28px system-ui,sans-serif';ctx.fillText('최애 사진을 올려주세요 ♡',W/2,H/2-8);ctx.font='500 17px system-ui,sans-serif';ctx.fillText('사진은 이 브라우저 밖으로 나가지 않아요',W/2,H/2+34)}ctx.restore();ctx.save();roundedPath(photoBox.x-11,photoBox.y-11,photoBox.w+22,photoBox.h+22,38);ctx.strokeStyle=t.frame;ctx.lineWidth=12;ctx.stroke();ctx.restore()}
  function drawStaticCover(img,x,y,w,h){if(!img?.naturalWidth||!img?.naturalHeight)return;const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
  function drawStaticCoverFocus(img,x,y,w,h,focusX=.5,focusY=.5,zoom=1){
    if(!img?.naturalWidth||!img?.naturalHeight)return;
    const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight)*Math.max(1,Number(zoom)||1),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
    const overflowX=Math.max(0,dw-w),overflowY=Math.max(0,dh-h);
    const dx=x-overflowX*clamp(Number(focusX)||.5,0,1),dy=y-overflowY*clamp(Number(focusY)||.5,0,1);
    ctx.drawImage(img,dx,dy,dw,dh);
  }
  function drawFilmStrip(e){
    const s=e.size,w=s*1.10,h=s*2.92,slotW=w*.70,slotH=(h-54)/3-7;
    ctx.save();ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowBlur=12;ctx.fillStyle='#090b11';roundedPath(-w/2,-h/2,w,h,9);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='rgba(245,247,255,.72)';
    for(let y=-h/2+12;y<h/2-8;y+=18){ctx.fillRect(-w/2+7,y,8,10);ctx.fillRect(w/2-15,y,8,10)}
    (e.images||[]).slice(0,3).forEach((src,i)=>{
      const img=sceneImages.get(src),y=-h/2+15+i*(slotH+8);
      ctx.fillStyle='#f7f8fb';ctx.fillRect(-slotW/2-2,y-2,slotW+4,slotH+4);
      ctx.save();ctx.beginPath();ctx.rect(-slotW/2,y,slotW,slotH);ctx.clip();if(img?.complete&&img.naturalWidth)drawStaticCover(img,-slotW/2,y,slotW,slotH);else ensureSceneImage(src).catch(()=>{});ctx.restore();
    });
    ctx.save();ctx.translate(-w*.40,-h*.28);ctx.rotate(-Math.PI/2);ctx.fillStyle='rgba(255,255,255,.86)';ctx.font='700 11px ui-monospace,monospace';ctx.fillText(String(e.label||'KODAK 400').slice(0,18),0,0);ctx.restore();ctx.save();ctx.translate(w*.39,h*.31);ctx.rotate(-Math.PI/2);ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='700 11px ui-monospace,monospace';ctx.fillText(String(e.artistLabel||'8TURN').slice(0,12),0,0);ctx.restore();ctx.fillStyle='rgba(255,255,255,.84)';ctx.font='700 10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('08',w*.28,h*.16);ctx.restore();
  }
  function drawPolaroid(e){
    const s=e.size,w=s*1.42,h=s*1.76,pad=s*.085,bottom=s*.36;
    ctx.save();ctx.shadowColor='rgba(30,35,55,.22)';ctx.shadowBlur=12;ctx.shadowOffsetY=7;ctx.fillStyle='#fffdf8';roundedPath(-w/2,-h/2,w,h,8);ctx.fill();ctx.shadowBlur=0;
    const src=e.image,img=sceneImages.get(src),ix=-w/2+pad,iy=-h/2+pad,iw=w-pad*2,ih=h-pad*2-bottom;
    ctx.save();ctx.beginPath();ctx.rect(ix,iy,iw,ih);ctx.clip();if(img?.complete&&img.naturalWidth)drawStaticCover(img,ix,iy,iw,ih);else ensureSceneImage(src).catch(()=>{});ctx.restore();
    ctx.fillStyle='#263d70';ctx.font='600 15px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';ctx.textAlign='center';ctx.fillText(String(e.caption||'favorite cut ♡').slice(0,24),0,h/2-bottom*.42);ctx.restore();
  }
  function drawSceneCrop(e){
    const s=e.size,w=s*Number(e.aspect||1.28),h=s;
    ctx.save();
    ctx.shadowColor='rgba(27,38,61,.22)';ctx.shadowBlur=10;ctx.shadowOffsetY=6;
    ctx.fillStyle='#fffdf8';roundedPath(-w/2-7,-h/2-7,w+14,h+14,5);ctx.fill();
    ctx.shadowBlur=0;
    const src=e.image,img=sceneImages.get(src);
    ctx.save();ctx.beginPath();ctx.rect(-w/2,-h/2,w,h);ctx.clip();
    if(img?.complete&&img.naturalWidth)drawStaticCoverFocus(img,-w/2,-h/2,w,h,e.focusX,e.focusY);
    else ensureSceneImage(src).catch(()=>{});
    ctx.restore();
    ctx.strokeStyle='rgba(58,77,111,.20)';ctx.lineWidth=2;ctx.strokeRect(-w/2,-h/2,w,h);
    ctx.restore();
  }
  function drawScrapNote(e){
    const s=e.size,w=s*2.05,h=s*1.80;
    ctx.save();ctx.shadowColor='rgba(37,54,84,.15)';ctx.shadowBlur=10;ctx.shadowOffsetY=5;
    ctx.fillStyle='#fffdf4';ctx.beginPath();ctx.moveTo(-w/2+8,-h/2);ctx.lineTo(w/2-5,-h/2+4);ctx.lineTo(w/2,h/2-8);ctx.lineTo(-w/2+4,h/2);ctx.lineTo(-w/2,-h/2+10);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='rgba(64,86,124,.16)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.strokeStyle='rgba(91,126,177,.16)';ctx.lineWidth=1;for(let y=-h*.20;y<h*.34;y+=18){ctx.beginPath();ctx.moveTo(-w*.39,y);ctx.lineTo(w*.39,y);ctx.stroke()}ctx.fillStyle='rgba(53,70,98,.52)';for(let y=-h*.30;y<h*.36;y+=22){ctx.beginPath();ctx.arc(-w*.43,y,4.2,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#304b78';ctx.textAlign='left';const lines=(Array.isArray(e.lines)?e.lines:[e.value||'same moment',e.detail||'different feeling ♡']).map(x=>String(x)).slice(0,4);
    ctx.font=`600 ${Math.max(13,s*.205)}px "Segoe Print","Bradley Hand","Comic Sans MS",cursive`;const start=-h*.30,step=Math.max(18,s*.235);lines.forEach((line,i)=>ctx.fillText(line.slice(0,30),-w*.38,start+i*step));
    ctx.restore();
  }
  function drawSceneTicket(e){
    const s=e.size,w=s*1.55,h=s*1.86;
    ctx.save();ctx.shadowColor='rgba(14,23,38,.24)';ctx.shadowBlur=10;ctx.shadowOffsetY=6;
    ctx.fillStyle='#cbd4e2';ctx.beginPath();ctx.moveTo(-w/2+6,-h/2);ctx.lineTo(w/2-5,-h/2+4);ctx.lineTo(w/2,h/2-7);ctx.lineTo(-w/2+4,h/2);ctx.lineTo(-w/2,-h/2+9);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(34,56,90,.28)';ctx.lineWidth=1.2;ctx.stroke();
    ctx.fillStyle='#1d3152';ctx.textAlign='left';ctx.font=`900 ${Math.max(16,s*.23)}px ui-monospace,monospace`;ctx.fillText(String(e.value||'8TURN').slice(0,16),-w*.36,-h*.29);
    ctx.font=`700 ${Math.max(9,s*.10)}px ui-monospace,monospace`;ctx.fillText('LIVE TOUR',-w*.36,-h*.12);ctx.fillText('OUR MOMENTS',-w*.36,-h*.01);
    const lines=String(e.detail||'DATE  2024. 10. 26\nAREA  STAGE\nSEAT  08').split('\n').slice(0,3);ctx.font=`700 ${Math.max(9,s*.095)}px ui-monospace,monospace`;lines.forEach((line,i)=>ctx.fillText(line.slice(0,24),-w*.36,h*(.14+i*.13)));
    const bx=w*.20,bw=w*.28;ctx.fillStyle='#1b2a44';for(let i=0;i<22;i++){const ww=(i%5===0?3:i%3===0?2:1.2);ctx.fillRect(bx+i*(bw/24),-h*.31,ww,h*.59)}
    ctx.restore();
  }
  function drawScenePaperScrap(e){
    const s=e.size,w=s*Number(e.aspect||1.7),h=s,color=e.color||'#f2f0e9';
    drawTornPatch(-w/2,-h/2,w,h,color,0,Number(e.seed||31),Number(e.alpha??.96));
    if(e.lines){ctx.save();ctx.strokeStyle=e.lineColor||'rgba(51,82,125,.16)';ctx.lineWidth=1;for(let y=-h*.28;y<h*.34;y+=18){ctx.beginPath();ctx.moveTo(-w*.40,y);ctx.lineTo(w*.40,y);ctx.stroke()}ctx.restore()}
  }
  function drawSceneTape(e){
    const s=e.size,w=s*1.7,h=s*.44,variant=e.variant||'blue';
    ctx.save();ctx.globalAlpha=.88;ctx.fillStyle=variant==='black'?'#111722':variant==='white'?'#e9edf3':'#3265ab';tornPaperPath(-w/2,-h/2,w,h,Number(e.seed||41),8,5);ctx.fill();
    if(variant==='blue'){ctx.globalAlpha=.22;ctx.strokeStyle='#fff';ctx.lineWidth=3;for(let x=-w/2;x<w/2;x+=17){ctx.beginPath();ctx.moveTo(x,-h/2);ctx.lineTo(x+17,h/2);ctx.stroke()}}ctx.globalAlpha=1;ctx.restore();
  }
  function drawSceneChrome(e){
    const s=e.size,variant=e.variant||'star',r=s*.5;
    ctx.save();ctx.shadowColor='rgba(0,0,0,.34)';ctx.shadowBlur=9;ctx.shadowOffsetY=4;
    ctx.fillStyle=gradient([[0,'#626b79'],[.13,'#fff'],[.28,'#949eae'],[.48,'#f8fbff'],[.68,'#656e7c'],[.84,'#fff'],[1,'#7d8694']],-r,-r,r,r);
    if(variant==='heart')heartPath(s);else starPath(s);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.86)';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
  function drawSceneClip(e){
    const s=e.size,w=s*.42,h=s*1.12;
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='rgba(0,0,0,.30)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;
    const metal=ctx.createLinearGradient(-w,0,w,0);metal.addColorStop(0,'#5f6877');metal.addColorStop(.28,'#f9fbff');metal.addColorStop(.52,'#9ca6b5');metal.addColorStop(.78,'#fff');metal.addColorStop(1,'#666f7d');
    ctx.strokeStyle=metal;ctx.lineWidth=Math.max(5,s*.09);
    ctx.beginPath();ctx.moveTo(0,h*.48);ctx.bezierCurveTo(w*.70,h*.48,w*.70,-h*.45,0,-h*.45);ctx.bezierCurveTo(-w*.48,-h*.45,-w*.48,h*.27,0,h*.27);ctx.bezierCurveTo(w*.25,h*.27,w*.25,-h*.23,0,-h*.23);ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=Math.max(1.5,s*.025);ctx.stroke();ctx.restore();
  }
  function drawMaterial(e,item,now){
    const s=e.size,t=(Number(now)||0)/1000;
    if(item.asset){
      const img=assetImages.get(item.asset);
      if(img?.complete&&img.naturalWidth){
        const scale=Number(item.assetScale||1),ratio=img.naturalHeight/img.naturalWidth;
        let w=s*scale,h=w*ratio;
        const maxH=s*1.65;if(h>maxH){const k=maxH/h;h*=k;w*=k}
        ctx.save();
        if(item.assetTone==='chrome')ctx.filter='grayscale(1) contrast(1.28) brightness(1.16)';
        if(item.motion&&!reducedMotion){
          const pulse=.98+.035*Math.sin(t*3.2);ctx.scale(pulse,pulse);
          ctx.globalAlpha=.9+.1*Math.sin(t*2.4);
          ctx.shadowColor=item.motion==='sparkle'?'rgba(255,185,230,.65)':'rgba(220,210,255,.45)';
          ctx.shadowBlur=8;
        }
        ctx.drawImage(img,-w/2,-h/2,w,h);
        ctx.restore();
        return;
      }
      ensureAsset(item).catch(()=>{});
    }
    if(item.kind==='emoji'){ctx.font=`${s}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;ctx.fillText(item.value,0,0);return}
    if(item.kind==='tape'){const w=s*1.65,h=s*.48;ctx.globalAlpha=.88;const fill=item.variant==='pink'?'#ffb7d5':item.variant==='lilac'?'#d9c5ff':item.variant==='blue'?'#4f78b5':item.variant==='black'?'#161a22':item.variant==='beige'?'#d9c5a5':null;ctx.fillStyle=fill||gradient([[0,'#ffc1df'],[.2,'#bfe8ff'],[.45,'#d7c3ff'],[.7,'#fff0ae'],[1,'#ffc7ec']],-w/2,0,w/2,0);ctx.fillRect(-w/2,-h/2,w,h);ctx.globalAlpha=item.variant==='black'?.18:.34;ctx.strokeStyle='#fff';ctx.lineWidth=3;for(let x=-w/2;x<w/2;x+=18){ctx.beginPath();ctx.moveTo(x,-h/2);ctx.lineTo(x+18,h/2);ctx.stroke()}ctx.globalAlpha=1;return}
    if(item.kind==='paper'){const date=item.variant==='date',w=s*(date?1.9:1.5),h=s*(date?0.48:1.05);ctx.shadowColor='rgba(50,35,65,.18)';ctx.shadowBlur=8;ctx.fillStyle=item.variant==='ticket'?'#fff0d7':date?'#e5ecfb':'#fffaf0';roundedPath(-w/2,-h/2,w,h,date?3:8);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(99,75,120,.22)';ctx.lineWidth=2;ctx.stroke();if(item.variant==='ticket'){ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(-w*.28,-h*.35);ctx.lineTo(-w*.28,h*.35);ctx.stroke();ctx.setLineDash([])}if(date){ctx.fillStyle='#304b78';ctx.font=`700 ${Math.max(10,s*.16)}px ui-monospace,monospace`;ctx.fillText(String(e.value||'DATE').slice(0,24),0,0)}return}
    if(item.kind==='label'){const artist=item.variant==='artist',w=s*(artist?2.35:2.05),h=s*.72;ctx.save();tornPaperPath(-w/2,-h/2,w,h,artist?211:223,10,5);ctx.shadowColor='rgba(20,30,48,.18)';ctx.shadowBlur=7;ctx.fillStyle=artist?'#f7f3e9':'#edf3fc';ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=artist?'rgba(45,49,56,.18)':'rgba(48,75,120,.20)';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=artist?'#151820':'#304b78';ctx.font=artist?`900 ${Math.max(15,s*.28)}px system-ui,-apple-system,"Segoe UI",sans-serif`:`700 ${Math.max(12,s*.20)}px ui-monospace,monospace`;ctx.fillText(String(e.value||'').slice(0,24),0,1);ctx.restore();return}
    if(item.kind==='pearl'){const count=item.variant==='chain'?6:1,r=s*.18,start=-(count-1)*r*1.25;for(let i=0;i<count;i++){const x=start+i*r*2.5,g=ctx.createRadialGradient(x-r*.35,-r*.4,r*.1,x,0,r);g.addColorStop(0,'#fff');g.addColorStop(.45,'#fff8fb');g.addColorStop(.75,'#e5dce9');g.addColorStop(1,'#aaa0b1');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,0,r,0,Math.PI*2);ctx.fill()}return}
    if(item.kind==='gem'){const r=s*.46;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.8,-r*.15);ctx.lineTo(r*.55,r*.7);ctx.lineTo(0,r);ctx.lineTo(-r*.55,r*.7);ctx.lineTo(-r*.8,-r*.15);ctx.closePath();ctx.fillStyle=gradient([[0,'#fff'],[.18,'#aee7ff'],[.42,'#e7c0ff'],[.66,'#ffb8d8'],[.85,'#fff5af'],[1,'#c4d6ff']],-r,-r,r,r);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.9)';ctx.lineWidth=3;ctx.stroke();if(item.motion&&!reducedMotion){const sweep=((t*.8)%1)*r*3-r*1.5;ctx.save();ctx.clip();const g=ctx.createLinearGradient(sweep-r*.25,0,sweep+r*.25,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.95)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore()}return}
    if(item.kind==='chrome'){const r=s*.48;ctx.fillStyle=gradient([[0,'#777'],[.16,'#fff'],[.32,'#a8b1c1'],[.5,'#fff'],[.7,'#737b8b'],[.86,'#fff'],[1,'#9098a6']],-r,-r,r,r);if(item.variant==='heart')heartPath(s);else starPath(s);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.stroke();return}
    if(item.kind==='jelly'){ctx.globalAlpha=.82;heartPath(s);ctx.fillStyle=gradient([[0,'#ff81bd'],[.5,'#ffa8d1'],[1,'#d773ff']],-s*.5,-s*.5,s*.5,s*.5);ctx.fill();ctx.globalAlpha=.7;ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();ctx.globalAlpha=1;return}
    if(item.kind==='lace'){const w=s*1.45,h=s*.8;ctx.strokeStyle='#fff';ctx.lineWidth=6;ctx.shadowColor='rgba(81,56,94,.24)';ctx.shadowBlur=5;ctx.beginPath();ctx.moveTo(-w/2,h/2);ctx.lineTo(-w/2,-h/2);ctx.lineTo(w/2,-h/2);ctx.stroke();ctx.shadowBlur=0;ctx.lineWidth=3;for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(-w/2+i*w/5,-h/2,9,0,Math.PI);ctx.stroke()}for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(-w/2,h/2-i*h/3,9,-Math.PI/2,Math.PI/2);ctx.stroke()}return}
    if(item.kind==='acrylic'){const r=s*.48;ctx.globalAlpha=.58;ctx.fillStyle=gradient([[0,'#c8e9ff'],[.48,'#ffd5eb'],[1,'#dfcaff']],-r,-r,r,r);ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=4;ctx.stroke();ctx.save();ctx.scale(.52,.52);heartPath(s);ctx.fillStyle='#ff79b6';ctx.fill();ctx.restore();ctx.beginPath();ctx.arc(0,-r-8,8,0,Math.PI*2);ctx.stroke();return}
    if(item.kind==='frame'){const scale=s/100,w=(photoBox.w+50)*scale,h=(photoBox.h+50)*scale,phase=reducedMotion?.5:((t*.12)%1);ctx.lineWidth=18*scale;const g=ctx.createLinearGradient(-w/2,0,w/2,0);g.addColorStop(0,'#ffb8db');g.addColorStop(clamp(phase-.18,0,1),'#c9c5ff');g.addColorStop(phase,'#fff');g.addColorStop(clamp(phase+.18,0,1),'#bfeaff');g.addColorStop(1,'#ffe4a8');ctx.strokeStyle=g;roundedPath(-w/2,-h/2,w,h,44*scale);ctx.stroke();return}
    if(item.kind==='sparkle'){const phase=reducedMotion?1:(.72+.28*Math.sin(t*4));ctx.globalAlpha=phase;ctx.fillStyle=gradient([[0,'#fff'],[.35,'#d4c2ff'],[.66,'#ff9dce'],[1,'#a7efff']],-s/2,0,s/2,0);ctx.beginPath();ctx.moveTo(0,-s*.55);ctx.quadraticCurveTo(s*.08,-s*.08,s*.55,0);ctx.quadraticCurveTo(s*.08,s*.08,0,s*.55);ctx.quadraticCurveTo(-s*.08,s*.08,-s*.55,0);ctx.quadraticCurveTo(-s*.08,-s*.08,0,-s*.55);ctx.fill();ctx.globalAlpha=1}
  }
  function drawElement(e,i,t,now){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.rotation);ctx.textAlign='center';ctx.textBaseline='middle';if(e.type==='sticker'){const item=itemById(e.stickerId);if(item)drawMaterial(e,item,now)}else if(e.type==='scene-filmstrip')drawFilmStrip(e);else if(e.type==='scene-polaroid')drawPolaroid(e);else if(e.type==='scene-crop')drawSceneCrop(e);else if(e.type==='scene-scrap-note')drawScrapNote(e);else if(e.type==='scene-ticket')drawSceneTicket(e);else if(e.type==='scene-paper-scrap')drawScenePaperScrap(e);else if(e.type==='scene-tape')drawSceneTape(e);else if(e.type==='scene-chrome')drawSceneChrome(e);else if(e.type==='scene-clip')drawSceneClip(e);else if(e.textStyle==='date-label'){const label=String(e.value||'').slice(0,24),w=Math.max(150,label.length*12+34),h=40;ctx.shadowColor='rgba(37,54,84,.16)';ctx.shadowBlur=7;ctx.fillStyle='#edf3fc';roundedPath(-w/2,-h/2,w,h,4);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(62,86,126,.18)';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#304b78';ctx.font=`700 ${Math.max(13,e.size)}px ui-monospace,monospace`;ctx.fillText(label,0,1)}else{ctx.font=e.textStyle==='handwritten'?`600 ${e.size}px "Segoe Print","Bradley Hand","Comic Sans MS",cursive`:`800 ${e.size}px system-ui,-apple-system,"Segoe UI",sans-serif`;if(theme==='stageblue'&&e.textStyle==='handwritten'){ctx.fillStyle='#173d80';const lines=String(e.value||'').split('\\n');const step=Math.max(18,e.size*1.05);lines.forEach((line,idx)=>ctx.fillText(line,0,(idx-(lines.length-1)/2)*step))}else{ctx.lineWidth=Math.max(3,e.size*(e.textStyle==='handwritten'?0.10:0.16));ctx.strokeStyle=theme==='midnight'?'#171724':'#fffdf8';ctx.strokeText(e.value,0,0);ctx.fillStyle=t.ink;ctx.fillText(e.value,0,0)}}if(i===selected){const r=elementRadius(e);ctx.strokeStyle='#7ff6c2';ctx.lineWidth=3;ctx.setLineDash([9,7]);ctx.strokeRect(-r,-r*.58,r*2,r*1.16);ctx.setLineDash([])}ctx.restore()}
  function statusText(){if(selected>=0)return`선택됨 · ${elements.length}/${limits.totalObjects}개 · 드래그해서 옮겨요`;if(photo&&sourceMeta?.source==='watch'){const who=sourceMeta.artist?`${sourceMeta.artist} · `:'';const when=Number.isFinite(Number(sourceMeta.time))?`${timeLabel(sourceMeta.time)} 장면`:'영상 장면';return`${who}${when}을 가져왔어요 ✨`}if(photo)return`꾸미는 중 · ${elements.length}/${limits.totalObjects}개`;return'사진을 먼저 골라주세요'}
  function draw(now=performance.now()){const t=themes[theme];ctx.clearRect(0,0,W,H);drawBackdrop(t);drawBackingLayer();drawLoaderBase();drawFrame(t);drawDecorativeFrame();elements.forEach((e,i)=>drawElement(e,i,t,now));drawPackageOverlay();drawSealOverlay();$('#selectionState').textContent=statusText()}
  function animationLoop(now){if(!reducedMotion&&document.visibilityState==='visible'&&elements.some(e=>e.type==='sticker'&&itemById(e.stickerId)?.motion))draw(now);requestAnimationFrame(animationLoop)}
  function canvasPoint(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height}}
  function hitTest(p){for(let i=elements.length-1;i>=0;i--){const e=elements[i],r=elementRadius(e);if(Math.hypot(p.x-e.x,p.y-e.y)<=r*1.05)return i}return-1}
  function newCompositionKey(){return `topkku_${Date.now()}_${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`.replace(/[^A-Za-z0-9:_-]/g,'').slice(0,120)}
  function loadReferenceSource(){
    let raw='';try{raw=sessionStorage.getItem('nuguTopkkuReference')||''}catch{}
    if(!raw){referenceSource=null;return}
    try{const data=JSON.parse(raw);if(!data?.id||!data?.eventKey||!data?.display_url)throw new Error('invalid_reference');referenceSource=data}catch{referenceSource=null}
    const panel=$('#topkkuReferencePanel');if(!panel)return;
    if(!referenceSource){panel.hidden=true;panel.innerHTML='';return}
    panel.hidden=false;panel.innerHTML=`<div class="reference-copy"><span>INSPIRED BY</span><b>${esc(referenceSource.artist_name||'다른 팬의 탑꾸')}</b><small>${esc(referenceSource.maker_name||'팬')}의 탑꾸를 옆에 두고 참고 중</small></div><img src="${esc(referenceSource.display_url)}" alt="참고 중인 탑꾸"><button type="button" id="clearTopkkuReference">참고 끝내기</button>`;
    $('#clearTopkkuReference')?.addEventListener('click',()=>{referenceSource=null;try{sessionStorage.removeItem('nuguTopkkuReference')}catch{}panel.hidden=true;panel.innerHTML=''});
  }
  function serverCatalogItem(id){return styleState?.items?.find?.(x=>x.id===id)||null}
  function accessFor(item){const server=serverCatalogItem(item.id);if(server)return{unlocked:!!server.unlocked,visible:server.visible!==false,gifted:!!server.gifted,label:server.gifted?'선물받음':item.access==='points'?`${item.unlockCost}P`:'사용 가능'};const starter=item.access==='free'&&Number(item.minBand||1)<=1;return{unlocked:starter,visible:starter,gifted:false,label:starter?'사용 가능':'아직 비공개'}}
  function emitStyleState(){window.NUGU_TOPKKU_STYLE_STATE=styleState;window.dispatchEvent(new CustomEvent('nugu-topkku-style-state',{detail:styleState||null}))}
  function leafMark(profile){const g=profile?.growth||{},phase=Math.max(1,Math.min(5,Number(g.leafPhase||1)));return `<span class="growth-leaf-mark band-${Number(g.bandIndex||1)}" aria-label="${esc(g.title||'성장 중')}">${[1,2,3,4,5].map(i=>`<i class="${i<=phase?'grown':''}">❧</i>`).join('')}</span>`}
  function previewGlyph(item){if(item.kind==='emoji')return item.value;return{tape:'▰',paper:'▤',scrap:'▱',framepiece:'▣',label:'TAG',metal:'⌇',doodle:'☺',pearl:'○',gem:'◆',chrome:item.variant==='heart'?'♡':'★',jelly:'♥',lace:'⌜',acrylic:'◉',frame:'▣',sparkle:'✦'}[item.kind]||'✦'}
  function renderStickerProfile(){const root=$('#stickerProfile');if(!root)return;const identity=window.NUGU_AUTH?.getIdentitySync?.();if(!identity?.authenticated){root.innerHTML='<b>기본 꾸미기는 바로 가능 ♡</b><span>로그인하면 놀았던 방식대로 잎과 덕질 결이 자라요.</span>';return}const p=styleState?.profile;if(!p){root.innerHTML='<b>꾸미기 서랍 불러오는 중…</b><span>지금까지의 덕질 기록을 살펴보고 있어요.</span>';return}const trait=p.traits?.primary?.label||'둘러보는 중',secondary=(p.traits?.secondary||[]).map(x=>x.label).join(' · ');root.innerHTML=`<div class="growth-profile-line">${leafMark(p)}<div><b>${esc(p.growth?.title||'반가운 새잎')} · ${esc(trait)}</b><span>${secondary?esc(secondary)+' · ':''}사용 가능한 활동포인트 ${Number(p.points?.balance||0)}P</span></div></div>`}
  function renderStickerGrid(){const root=$('#stickerGrid');if(!root)return;const rows=catalog.items.filter(item=>{const a=accessFor(item);return a.visible&&(activeStickerPack==='all'||item.pack===activeStickerPack)});root.innerHTML=rows.length?rows.map(item=>{const a=accessFor(item),motion=item.motion&&!reducedMotion,visual=item.asset?`<img src="${esc(item.asset)}" alt="" loading="lazy" draggable="false">`:esc(previewGlyph(item));return `<button type="button" class="material-sticker ${a.unlocked?'':'locked'} ${a.gifted?'gifted-item':''} ${motion?'motion-item':''}" data-sticker-id="${esc(item.id)}" title="${esc(item.label)}"><span class="sticker-swatch kind-${esc(item.kind)} variant-${esc(item.variant||'base')} ${item.asset?'has-asset':''}">${visual}</span><b>${esc(item.label)}</b><small>${a.unlocked?(a.gifted?'🎁 선물받음':motion?'LIVE ✦':'사용 가능'):`🔒 ${esc(a.label)}`}</small></button>`}).join(''):'<div class="sticker-empty-band">지금 이 서랍에서 꺼낼 수 있는 꾸미기는 여기까지예요. ♡</div>';root.querySelectorAll('[data-sticker-id]').forEach(b=>b.onclick=()=>handleStickerClick(b.dataset.stickerId))}
  async function signedIdentity(message='이 기능은 로그인 후 사용할 수 있어요.'){let identity=null;try{identity=await window.NUGU_AUTH?.getIdentity?.()}catch{}if(identity?.authenticated&&identity.accessToken)return identity;const state=$('#webSaveState');if(state)state.textContent=message;window.NUGU_AUTH_UI?.signIn?.(location.href);return null}
  async function unlockSticker(item){const identity=await signedIdentity('희귀 스티커는 로그인 후 영구 해금할 수 있어요.');if(!identity)return;const balance=Number(styleState?.profile?.points?.balance||0);if(balance<Number(item.unlockCost||0)){guide(`${item.label}은 ${item.unlockCost}P가 필요해요. 지금은 ${balance}P 있어요.`);return}guide(`${item.label} 영구 해금 중…`);try{const r=await fetch(`${apiBase()}/api/v1/community/style/unlock/${encodeURIComponent(item.id)}`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',...(window.NUGU_AUTH?.authHeaders?.(identity)||{})},body:JSON.stringify({visitorId:identity.visitorId})});const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data.error||'unlock_failed'),{code:data.error});styleState={profile:data.profile,items:data.items};renderStickerProfile();renderStickerGrid();emitStyleState();guide(`${item.label} 영구 해금 완료 ♡ 이제 횟수 차감 없이 계속 쓸 수 있어요.`)}catch(e){guide(e.code==='insufficient_style_points'?'포인트가 조금 부족해요. 덕질하다 보면 자연스럽게 쌓여요.':'지금은 해금하지 못했어요.')}}
  async function handleStickerClick(id){const item=itemById(id);if(!item)return;const access=accessFor(item);if(!access.unlocked){if(item.access==='points'){await unlockSticker(item);return}const identity=window.NUGU_AUTH?.getIdentitySync?.();if(!identity?.authenticated){await signedIdentity('꾸미기 서랍은 로그인 후 덕질 기록과 연결돼요.');return}guide('조금 더 놀다 보면 다음 꾸미기 서랍이 편지와 함께 열려요. ♡');return}if(item.asset){try{await ensureAsset(item)}catch{guide(`${item.label} 벡터 장식을 불러오지 못했어요. 다시 눌러줘.`);return}}addStickerItem(item)}
  async function loadStyleState(){const sync=window.NUGU_AUTH?.getIdentitySync?.();if(!sync?.authenticated){styleState=null;renderStickerProfile();renderStickerGrid();emitStyleState();return}try{const identity=await window.NUGU_AUTH.getIdentity();if(!identity?.authenticated)return;const r=await fetch(`${apiBase()}/api/v1/community/style/me?visitorId=${encodeURIComponent(identity.visitorId)}`,{headers:{Accept:'application/json',...(window.NUGU_AUTH?.authHeaders?.(identity)||{})},cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error||'style_failed');styleState=data}catch(e){console.warn('style state',e);styleState=null}renderStickerProfile();renderStickerGrid();emitStyleState()}
  function renderSceneCutAvailability(){for(const id of ['buildBlueStage','buildPinkLace']){const b=$('#'+id);if(b){b.disabled=!photo;b.title=photo?'베이스이미지 1장 위에 등록된 실제 파츠만 배치합니다.':'베이스이미지를 먼저 골라주세요.'}}}
  function presetSticker(id,fallbackId,props={}){
    const candidates=[id,fallbackId].filter(Boolean);
    for(const candidate of candidates){
      const item=itemById(candidate);if(!item)continue;
      const access=accessFor(item);if(!access.unlocked)continue;
      const value=props.value??(item.dynamic==='artist'?String(selectedArtist?.name||sourceMeta?.artist||'MY PICK').slice(0,18):item.dynamic==='date'?capturedDateLabel():item.value??'');return {type:'sticker',stickerId:item.id,value,x:props.x??W/2,y:props.y??H/2,size:props.size??(Number(item.defaultSize||0)||(item.kind==='tape'?90:76)),rotation:props.rotation??0,preset:props.preset||'blue-stage'};
    }
    return null;
  }
  function capturedDateLabel(){
    const raw=String(sourceMeta?.capturedAt||'');
    const d=new Date(raw);
    if(Number.isNaN(d.getTime()))return 'SCENE '+timeLabel(sourceMeta?.time);
    const yyyy=d.getFullYear(),mm=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
    return `${yyyy} . ${mm} . ${dd}`;
  }
  async function buildBlueStageReconstruction(){
    if(!photo){guide('베이스이미지를 먼저 골라줘 ♡');return}
    const button=$('#buildBlueStage');if(button?.disabled)return;
    const artistLabel=String(selectedArtist?.name||sourceMeta?.artist||'MY PICK').trim().slice(0,18)||'MY PICK';
    const additions=[
      presetSticker('paper-scrap-blue','tape-blue',{x:118,y:84,size:124,rotation:-.12}),
      presetSticker('paper-scrap-white','note-paper',{x:562,y:96,size:108,rotation:.08}),
      presetSticker('tape-blue',null,{x:170,y:165,size:98,rotation:-.10}),
      presetSticker('tape-black','tape-blue',{x:541,y:182,size:92,rotation:.09}),
      presetSticker('film-frame-empty','paper-scrap-black',{x:116,y:320,size:118,rotation:-.055}),
      presetSticker('polaroid-empty','paper-scrap-white',{x:590,y:285,size:118,rotation:.06}),
      presetSticker('paper-scrap-grid','paper-scrap-white',{x:573,y:500,size:98,rotation:-.05}),
      presetSticker('paper-scrap-black','paper-scrap-blue',{x:112,y:620,size:110,rotation:.055}),
      presetSticker('tape-beige','tape-blue',{x:164,y:744,size:96,rotation:.10}),
      presetSticker('paper-scrap-white','note-paper',{x:521,y:760,size:112,rotation:-.07}),
      presetSticker('artist-tag','note-paper',{x:204,y:905,size:106,rotation:-.065,value:artistLabel.toUpperCase()}),
      presetSticker('captured-date-tag','date-strip',{x:492,y:938,size:88,rotation:.028,value:capturedDateLabel()}),
      presetSticker('paperclip-silver','sparkle',{x:73,y:182,size:76,rotation:.18}),
      presetSticker('doodle-smile','heart-outline',{x:622,y:828,size:72,rotation:-.08}),
      presetSticker('silver-star','star',{x:623,y:150,size:60,rotation:.14}),
      presetSticker('chrome-heart','heart-outline',{x:91,y:478,size:64,rotation:-.14}),
      presetSticker('heart-outline',null,{x:616,y:620,size:58,rotation:.08}),
      presetSticker('star',null,{x:104,y:846,size:52,rotation:-.16}),
      presetSticker('tape-blue',null,{x:342,y:1014,size:108,rotation:-.02}),
      presetSticker('paper-scrap-blue','tape-blue',{x:590,y:1030,size:100,rotation:.06})
    ].filter(Boolean);
    const retained=elements.filter(e=>e.preset!=='blue-stage');
    if(retained.length+additions.length>limits.totalObjects){guide('현재 붙어 있는 스티커가 많아서 시안을 한 번에 더 붙일 수 없어요.');return}
    saveHistory();elements=[...retained,...additions];theme='stageblue';photoView={...photoView};selected=-1;
    $$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme==='stageblue'));
    guide('베이스이미지 1장 + 실제 꾸미기스티커만으로 스크랩북 시안을 배치했어 ♡');
    draw();
  }
  async function buildPinkLaceTopkku(){
    if(!photo){guide('베이스이미지를 먼저 골라줘 ♡');return}
    const artistLabel=String(selectedArtist?.name||sourceMeta?.artist||'MY PICK').trim().slice(0,18)||'MY PICK';
    const P=(id,fallback,props={})=>presetSticker(id,fallback,{...props,preset:'pink-lace'});
    const additions=[
      P('satin-bow-pearl-pink','big-ribbon-pink',{x:58,y:158,size:146,rotation:-.075}),
      P('rose-pearl-corner-pink','rose-vine-pink',{x:150,y:858,size:210,rotation:-.06}),
      P('crystal-heart-chain-pink','pearl-garland',{x:522,y:842,size:232,rotation:.022}),
      P('sparkle',null,{x:642,y:555,size:30,rotation:.10}),
      P('artist-tag','note-paper',{x:244,y:982,size:100,rotation:-.035,value:artistLabel.toUpperCase()}),
      P('captured-date-tag','date-strip',{x:510,y:991,size:78,rotation:.015,value:capturedDateLabel()})
    ].filter(Boolean);
    const retained=elements.filter(e=>e.preset!=='pink-lace');
    if(retained.length+additions.length>limits.totalObjects){guide('현재 붙어 있는 꾸미기가 많아서 핑크 레이스 시안을 더 붙일 수 없어요.');return}
    saveHistory();
    shellState={loaderId:'clear',frameId:'lace-white',backingId:'pink',packageId:'opp-flap',sealId:'none'};
    elements=[...retained,...additions];theme='pink';selected=-1;
    renderShellControls();$$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme==='pink'));
    guide('Pink Lace v5 · 새틴 리본 + 로즈 펄 코너 + 크리스탈 체인 실제 파츠 시안 ♡');
    draw();
  }
  function setArtist(artist){const next=artist?.slug?{slug:String(artist.slug).toLowerCase(),name:String(artist.name||artist.korean_name||artist.slug)}:null;if(selectedArtist?.slug!==next?.slug)markDirty();selectedArtist=next;for(const e of elements){if(e.type==='sticker'&&itemById(e.stickerId)?.dynamic==='artist')e.value=String(selectedArtist?.name||sourceMeta?.artist||'MY PICK').slice(0,18)}const box=$('#topkkuArtistConnected');if(box)box.innerHTML=selectedArtist?`<b>${esc(selectedArtist.name)}</b><span>웹 보관함과 아지트 공개 대상을 이 팀으로 연결했어요.</span>`:'아직 팀이 연결되지 않았어요.';const results=$('#topkkuArtistResults');if(results)results.innerHTML='';const input=$('#topkkuArtistSearch');if(input&&selectedArtist)input.value=selectedArtist.name}
  function loadPhotoData(src,meta=null){if(!src)return;const img=new Image();img.onload=()=>{photo=img;photoView=defaultPhotoView();sourceMeta=meta;configurePhotoBox(img,meta);compositionEventKey=newCompositionKey();currentSavedId=null;currentSavedPublished=false;lastSavedEventKey='';if(meta?.artistSlug)setArtist({slug:meta.artistSlug,name:meta.artist||meta.artistSlug});selected=-1;renderSceneCutAvailability();draw();renderSaveState()};img.onerror=()=>{sourceMeta=null;resetPhotoBox();compositionEventKey='';renderSceneCutAvailability();draw()};img.src=src}
  function loadIncoming(){let raw='';try{raw=sessionStorage.getItem('nuguTopkkuIncoming')||'';sessionStorage.removeItem('nuguTopkkuIncoming')}catch{}if(!raw)return false;try{const data=JSON.parse(raw);if(!data?.image)return false;loadPhotoData(data.image,data);return true}catch{return false}}
  canvas.addEventListener('pointerdown',ev=>{const p=canvasPoint(ev),i=hitTest(p);selected=i;if(i>=0){markDirty();drag={dx:p.x-elements[i].x,dy:p.y-elements[i].y,before:{...elements[i]}};canvas.setPointerCapture?.(ev.pointerId)}draw()});
  canvas.addEventListener('pointermove',ev=>{if(!drag||selected<0)return;const p=canvasPoint(ev),e=elements[selected];e.x=clamp(p.x-drag.dx,24,W-24);e.y=clamp(p.y-drag.dy,24,H-24);draw()});
  canvas.addEventListener('pointerup',()=>{if(drag&&selected>=0){const before=drag.before,after=elements[selected];if(before.x!==after.x||before.y!==after.y){history.push({theme,elements:elements.map((e,i)=>i===selected?{...before}:{...e}),photoView:{...photoView},shellState:{...shellState}});if(history.length>30)history.shift()}}drag=null});
  $('#photoInput').addEventListener('change',ev=>{const file=ev.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>loadPhotoData(reader.result,null);reader.readAsDataURL(file)});
  function editPhoto(fn){if(!photo)return;saveHistory();fn(photoView);selected=-1;draw()}
  $('#photoZoomOut').onclick=()=>editPhoto(v=>v.zoom=clamp(v.zoom/1.12,1,3));$('#photoZoomIn').onclick=()=>editPhoto(v=>v.zoom=clamp(v.zoom*1.12,1,3));$('#photoLeft').onclick=()=>editPhoto(v=>v.x-=34);$('#photoRight').onclick=()=>editPhoto(v=>v.x+=34);$('#photoUp').onclick=()=>editPhoto(v=>v.y-=34);$('#photoDown').onclick=()=>editPhoto(v=>v.y+=34);$('#photoCenter').onclick=()=>editPhoto(v=>{v.zoom=1;v.x=0;v.y=0});
  $$('#themeGrid [data-theme]').forEach(b=>b.addEventListener('click',()=>{if(theme===b.dataset.theme)return;saveHistory();theme=b.dataset.theme;$$('[data-theme]').forEach(x=>x.classList.toggle('active',x===b));draw()}));
  $$('#stickerPackTabs [data-sticker-pack]').forEach(b=>b.addEventListener('click',()=>{activeStickerPack=b.dataset.stickerPack;$$('#stickerPackTabs [data-sticker-pack]').forEach(x=>x.classList.toggle('active',x===b));renderStickerGrid()}));
  $('#addText').addEventListener('click',()=>addText($('#textInput').value));$('#textInput').addEventListener('keydown',e=>{if(e.key==='Enter')addText(e.currentTarget.value)});
  $$('.quick-copy [data-copy]').forEach(b=>b.addEventListener('click',()=>addText(b.dataset.copy,b.dataset.textStyle||'default')));
  $('#buildBlueStage')?.addEventListener('click',()=>buildBlueStageReconstruction());$('#buildPinkLace')?.addEventListener('click',()=>buildPinkLaceTopkku());
  function editSelected(fn){if(selected<0)return;saveHistory();fn(elements[selected]);draw()}
  const maxElementSize=e=>e?.type==='sticker'&&itemById(e.stickerId)?.kind==='signature'?420:180;
  $('#smaller').onclick=()=>editSelected(e=>e.size=clamp(e.size*.88,18,maxElementSize(e)));$('#bigger').onclick=()=>editSelected(e=>e.size=clamp(e.size*1.12,18,maxElementSize(e)));$('#rotateLeft').onclick=()=>editSelected(e=>e.rotation-=Math.PI/18);$('#rotateRight').onclick=()=>editSelected(e=>e.rotation+=Math.PI/18);$('#deleteElement').onclick=()=>{if(selected<0)return;saveHistory();elements.splice(selected,1);selected=-1;draw()};
  $('#undoBtn').onclick=()=>restore(history.pop());
  $('#resetBtn').onclick=()=>{if(!photo&&!elements.length&&theme==='lavender'&&JSON.stringify(shellState)===JSON.stringify(shellCatalog.defaults))return;saveHistory();photo=null;photoView=defaultPhotoView();sourceMeta=null;resetPhotoBox();compositionEventKey='';elements=[];selected=-1;theme='lavender';shellState={...shellCatalog.defaults};currentSavedId=null;currentSavedPublished=false;lastSavedEventKey='';setArtist(null);renderSceneCutAvailability();renderShellControls();$$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme==='lavender'));$('#photoInput').value='';draw();renderSaveState()};
  function visitorId(){const a=window.NUGU_AUTH?.getIdentitySync?.();if(a?.visitorId)return a.visitorId;let id=localStorage.getItem('nuguVisitorId');if(!id){id=(crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g,'');localStorage.setItem('nuguVisitorId',id)}return id}
  async function searchArtists(q){const root=$('#topkkuArtistResults'),base=apiBase();if(!root||!base||q.trim().length<1){if(root)root.innerHTML='';return}try{const r=await fetch(`${base}/api/v1/search?q=${encodeURIComponent(q.trim())}`,{headers:{Accept:'application/json'},cache:'no-store'});const data=await r.json();const rows=(data.items||[]).slice(0,6);root.innerHTML=rows.length?rows.map(a=>`<button type="button" data-topkku-artist="${esc(a.slug)}" data-topkku-name="${esc(a.name)}">${a.image_url?`<img src="${esc(a.image_url)}" alt="">`:''}<span><b>${esc(a.name)}</b><small>${esc(a.korean_name||a.agency||'')}</small></span></button>`).join(''):'<div class="topkku-team-empty">검색되는 팀이 없어요.</div>';root.querySelectorAll('[data-topkku-artist]').forEach(b=>b.onclick=()=>setArtist({slug:b.dataset.topkkuArtist,name:b.dataset.topkkuName}))}catch{root.innerHTML='<div class="topkku-team-empty">팀 검색을 잠시 불러오지 못했어요.</div>'}}
  $('#topkkuArtistSearch')?.addEventListener('input',e=>{clearTimeout(searchTimer);const q=e.currentTarget.value;searchTimer=setTimeout(()=>searchArtists(q),220)});
  function motionEffects(){return elements.filter(e=>e.type==='sticker'&&itemById(e.stickerId)?.motion).slice(0,limits.motionObjects).map(e=>({id:e.stickerId,x:Number((e.x/W*100).toFixed(3)),y:Number((e.y/H*100).toFixed(3)),size:Number((e.size/W*100).toFixed(3)),rotation:Number((e.rotation*180/Math.PI).toFixed(2))}))}
  function stickerIds(){return elements.filter(e=>e.type==='sticker').map(e=>e.stickerId).filter(Boolean)}
  function canvasPngData(){const old=selected;selected=-1;draw(performance.now());const data=canvas.toDataURL('image/png',1);selected=old;draw();return data}
  async function saveWeb(){
    const state=$('#webSaveState');if(saveBusy)return null;
    if(!photo){state.textContent='사진을 먼저 골라줘 ♡';return null}
    if(!selectedArtist){state.textContent='웹에 저장하려면 어느 팀 탑꾸인지 먼저 연결해줘.';$('#topkkuArtistSearch')?.focus();return null}
    const identity=await signedIdentity('웹 보관함 저장은 로그인 후 가능해요. 편집과 PNG 저장은 로그인 없이도 계속 할 수 있어요.');if(!identity)return null;
    if(currentSavedId){state.textContent='이 버전은 이미 내 웹 보관함에 저장돼 있어요 ♡';return{id:currentSavedId,published:currentSavedPublished}}
    saveBusy=true;renderSaveState();state.textContent='Cloudinary에 완성본을 보관하는 중…';
    try{
      const key=compositionEventKey||newCompositionKey();compositionEventKey=key;
      const url=apiBase()+'/api/v1/community/topkku/'+encodeURIComponent(selectedArtist.slug)+'/save';
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',...(window.NUGU_AUTH?.authHeaders?.(identity)||{})},body:JSON.stringify({visitorId:identity.visitorId,eventKey:key,imageData:canvasPngData(),source:sourceMeta?.source==='watch'?'watch-topkku':'topkku',sourceContentUrl:sourceMeta?.contentUrl||'',sourceTitle:sourceMeta?.title||'',objectCount:elements.length,stickerIds:stickerIds(),effects:motionEffects(),shell:{...shellState},referenceEventKey:referenceSource?.eventKey||''})});
      const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data.error||'save_failed'),{code:data.error,status:r.status,data});
      currentSavedId=Number(data.item?.id)||null;currentSavedPublished=!!data.published||!!data.item?.published_at;lastSavedEventKey=key;if(data.usage)vaultUsage={...(vaultUsage||{}),...data.usage};
      state.innerHTML='내 웹 보관함에 저장 완료 ♡ '+(data.item?.secure_url?'<a href="'+esc(data.item.secure_url)+'" target="_blank" rel="noopener">Cloudinary 원본 보기</a>':'');
      await Promise.all([loadVault(),loadStyleState()]);renderSaveState();return{id:currentSavedId,published:currentSavedPublished}
    }catch(e){
      state.textContent=e.code==='daily_topkku_save_limit'?'오늘 웹 보관 한도 '+limits.privateSavesPerDay+'개를 다 썼어요. 만들기와 PNG 저장은 계속 무제한이에요.':e.code==='sticker_locked'?'잠긴 스티커가 포함되어 있어요. 해금 상태를 다시 확인해줘.':e.code==='topkku_motion_limit'?'움직이는 장식은 작품당 '+limits.motionObjects+'개까지예요.':e.code==='sign_in_required'?'로그인이 필요해요.':e.code==='FST_ERR_CTP_BODY_TOO_LARGE'||e.status===413?'완성본 용량이 커서 저장하지 못했어요. 자동 최적화 후 다시 시도해줘.':e.code==='cloudinary_not_configured'?'이미지 보관 서버 연결을 확인하고 있어요.':e.code==='cloudinary_request_failed'?'이미지 보관 서버 응답이 늦어요. 다시 시도해줘.':'웹에 저장하지 못했어요. 다시 시도해줘.';return null
    }finally{saveBusy=false;renderSaveState()}
  }
  async function publishSaved(id,artistSlug=selectedArtist?.slug){
    const identity=await signedIdentity('아지트 공개는 로그인 후 가능해요.');if(!identity||!id||!artistSlug)return false;
    saveBusy=true;renderSaveState();$('#webSaveState').textContent='아지트 탑꾸 벽에 붙이는 중…';
    try{
      const url=apiBase()+'/api/v1/community/topkku/'+encodeURIComponent(artistSlug)+'/'+encodeURIComponent(id)+'/publish';
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',...(window.NUGU_AUTH?.authHeaders?.(identity)||{})},body:JSON.stringify({visitorId:identity.visitorId})});
      const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data.error||'publish_failed'),{code:data.error,data});
      if(Number(id)===Number(currentSavedId))currentSavedPublished=true;if(data.usage)vaultUsage={...(vaultUsage||{}),...data.usage};
      $('#webSaveState').innerHTML='아지트 벽에 붙였어 ♡ <a href="room.html?artist='+encodeURIComponent(artistSlug)+'&tab=topkku">바로 보러가기 →</a>';
      await Promise.all([loadVault(),loadStyleState()]);renderSaveState();return true
    }catch(e){$('#webSaveState').textContent=e.code==='daily_topkku_publish_limit'?'오늘 아지트 공개 한도 '+limits.publicPostsPerDay+'개를 다 썼어요. 내 웹 보관함 저장은 계속 가능해요.':e.code==='sign_in_required'?'로그인이 필요해요.':'아지트 벽에 붙이지 못했어요.';return false}
    finally{saveBusy=false;renderSaveState()}
  }
  $('#webSaveBtn').onclick=()=>saveWeb();
  $('#publishBtn').onclick=async()=>{const saved=currentSavedId?{id:currentSavedId}:await saveWeb();if(saved?.id)await publishSaved(saved.id,selectedArtist?.slug)};
  $('#downloadBtn').onclick=()=>{const old=selected;selected=-1;draw();canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');const url=URL.createObjectURL(blob);const who=String(selectedArtist?.name||sourceMeta?.artist||'').trim().replace(/[^0-9A-Za-z가-힣_-]+/g,'-').replace(/^-+|-+$/g,'');a.href=url;a.download=`nugu-radar-topkku${who?`-${who}`:''}-${Date.now()}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);selected=old;draw()},'image/png',1)};
  function vaultCard(item){return '<article class="vault-card" data-vault-id="'+Number(item.id)+'" data-bucket="'+esc(item.bucket_key||'inbox')+'"><a href="'+esc(item.secure_url)+'" target="_blank" rel="noopener"><img src="'+esc(item.display_url||item.secure_url)+'" alt="'+esc(item.artist_name||'탑꾸')+'" loading="lazy"></a><div><b>'+esc(item.artist_name||item.artist_slug||'탑꾸')+'</b><span>'+(item.published_at?'아지트 공개됨':'내 보관함만')+'</span><div class="vault-actions">'+(item.published_at?'<a href="room.html?artist='+encodeURIComponent(item.artist_slug)+'&tab=topkku">벽 보기</a><button type="button" data-reactions="'+Number(item.id)+'">반응한 팬들 🎁</button>':'<button type="button" data-vault-publish="'+Number(item.id)+'" data-vault-artist="'+esc(item.artist_slug)+'">아지트에 붙이기</button>')+'</div></div></article>'}
  async function loadVault(){
    const state=$('#topkkuVaultState'),root=$('#topkkuVaultGrid');if(!state||!root)return;
    const sync=window.NUGU_AUTH?.getIdentitySync?.();
    if(!sync?.authenticated){vaultUsage=null;root.innerHTML='';state.innerHTML='로그인하면 최근 웹 저장 탑꾸를 여기서 볼 수 있어요. <button type="button" id="vaultLogin">로그인</button>';$('#vaultLogin')?.addEventListener('click',()=>window.NUGU_AUTH_UI?.signIn?.(location.href));renderUsage();return}
    try{
      const identity=await window.NUGU_AUTH.getIdentity();
      const url=apiBase()+'/api/v1/community/topkku/me?visitorId='+encodeURIComponent(identity.visitorId)+'&limit=24';
      const r=await fetch(url,{headers:{Accept:'application/json',...(window.NUGU_AUTH?.authHeaders?.(identity)||{})},cache:'no-store'});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'vault_failed');
      vaultUsage=data.usage||null;
      state.textContent='오늘 웹 보관 '+Number(data.usage?.savedToday||0)+'/'+Number(data.usage?.saveLimit||30)+' · 아지트 공개 '+Number(data.usage?.publishedToday||0)+'/'+Number(data.usage?.publishLimit||10);
      root.innerHTML=data.items?.length?data.items.map(vaultCard).join(''):'<div class="topkku-vault-empty">아직 웹에 저장한 탑꾸가 없어요.</div>';
      root.querySelectorAll('[data-vault-publish]').forEach(b=>b.onclick=()=>publishSaved(Number(b.dataset.vaultPublish),b.dataset.vaultArtist));
      renderUsage();window.dispatchEvent(new CustomEvent('nugu-topkku-vault-rendered',{detail:{scope:'mine',items:data.items||[]}}));
    }catch(e){console.warn('vault',e);state.textContent='내 웹 보관함을 잠시 불러오지 못했어요.'}
  }
  async function loadArtistFromQuery(){const slug=new URLSearchParams(location.search).get('artist');if(!slug||!apiBase())return;try{const r=await fetch(`${apiBase()}/api/v1/community/topkku/${encodeURIComponent(slug)}?limit=1`,{headers:{Accept:'application/json'},cache:'no-store'});if(r.ok){const data=await r.json();if(data.artist?.slug)setArtist(data.artist)}}catch{}}
  window.__NUGU_TOPKKU_FRAME_STATE__=()=>({photoBox:{...photoBox},source:sourceMeta?.source||'',sourceSize:photo?{width:photo.naturalWidth,height:photo.naturalHeight}:null,zoom:photoView.zoom,shell:{...shellState}});
  window.addEventListener('nugu-auth-changed',()=>{loadStyleState();loadVault()});
  window.NUGU_TOPKKU_LOAD_VAULT=loadVault;window.NUGU_TOPKKU_LOAD_STYLE=loadStyleState;window.NUGU_TOPKKU_API_BASE=apiBase;$('#versionLabel').textContent=(window.NUGU_CONFIG||{}).build||'Updated 2026.09.12';preloadStickerAssets();setArtist(null);loadReferenceSource();renderStickerProfile();renderStickerGrid();renderShellControls();renderSaveState();renderSceneCutAvailability();draw();requestAnimationFrame(animationLoop);const incoming=loadIncoming();if(!incoming)loadArtistFromQuery();loadStyleState();loadVault();
})();

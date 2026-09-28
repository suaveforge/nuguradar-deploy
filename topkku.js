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
  let theme='lavender',photo=null,photoView=defaultPhotoView(),elements=[],selected=-1,drag=null,history=[],sourceMeta=null,compositionEventKey='',selectedArtist=null,saveBusy=false,searchTimer=null,blueStageMainSrc='';
  let activeStickerPack='all',styleState=null,vaultUsage=null,currentSavedId=null,currentSavedPublished=false,lastSavedEventKey='',referenceSource=null;
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  const assetImages=new Map(),assetPromises=new Map();
  const sceneImages=new Map(),scenePromises=new Map();
  const blueStageOverlayImage=new Image();
  let blueStageOverlayReady=false,blueStageExactFrames=null;
  blueStageOverlayImage.decoding='async';
  blueStageOverlayImage.onload=()=>{blueStageOverlayReady=true;draw()};
  blueStageOverlayImage.onerror=()=>{blueStageOverlayReady=false};
  if(window.NUGU_BLUE_STAGE_MASTER_OVERLAY)blueStageOverlayImage.src=window.NUGU_BLUE_STAGE_MASTER_OVERLAY;
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
  async function blueStageVisualScore(src){
    const img=await ensureSceneImage(src);
    const c=document.createElement('canvas');c.width=48;c.height=27;
    const g=c.getContext('2d',{willReadFrequently:true});if(!g)return 0;
    g.drawImage(img,0,0,c.width,c.height);
    const d=g.getImageData(0,0,c.width,c.height).data;
    let skin=0,blue=0,detail=0,greenCast=0,n=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      const i=(y*c.width+x)*4,r=d[i],gg=d[i+1],b=d[i+2];n++;
      if(r>gg*1.05&&gg>b*.92&&r>65&&gg>45)skin++;
      if(b>r*1.08&&b>gg*1.06&&b>55)blue++;
      if(gg>r*1.32&&gg>b*1.18&&gg>70)greenCast++;
      if(x){const j=i-4;detail+=Math.abs(r-d[j])+Math.abs(gg-d[j+1])+Math.abs(b-d[j+2])}
    }
    return skin/n*4+blue/n*2+Math.min(1,detail/(n*75))-(greenCast/n)*6;
  }
  const BLUE_STAGE_EXACT_VIDEO='WxL5cNNelLk';
  const BLUE_STAGE_EXACT_TIMES=Object.freeze({
    main:70,
    film1:62,
    film2:64,
    film3:78,
    polaroid:140,
    lowerFace:78,
    lowerStage:136
  });
  const BLUE_STAGE_EXACT_FOCUS=Object.freeze({
    main:[.27,.47],
    film1:[.50,.48],
    film2:[.54,.50],
    film3:[.72,.48],
    polaroid:[.72,.48],
    lowerFace:[.72,.43],
    lowerStage:[.50,.55]
  });
  async function fetchBlueStageExactRoleFrames(){
    if(String(sourceMeta?.videoId||'')!==BLUE_STAGE_EXACT_VIDEO)return null;
    const out={};
    for(const [role,time] of Object.entries(BLUE_STAGE_EXACT_TIMES)){
      const shot=await fetchWatchSceneFrame(time);
      out[role]=shot.image;
      await ensureSceneImage(shot.image);
    }
    return out;
  }
  async function pickBlueStageFrames(srcs){
    const unique=[...new Set(srcs.filter(Boolean))],scored=[];
    for(const src of unique){try{scored.push({src,score:await blueStageVisualScore(src)})}catch{}}
    scored.sort((a,b)=>b.score-a.score);return scored.map(x=>x.src);
  }
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const esc=s=>String(s??'').replace(/[&<>'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]));
  const apiBase=()=>String((window.NUGU_CONFIG||{}).apiBase||'').replace(/\/$/,'');
  const timeLabel=s=>{const n=Math.max(0,Math.floor(Number(s)||0)),m=Math.floor(n/60),sec=n%60;return`${m}:${String(sec).padStart(2,'0')}`};
  const itemById=id=>catalog.byId?.get?.(id)||catalog.items.find(x=>x.id===id)||null;
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
  function snapshot(){return{theme,elements:elements.map(e=>({...e,images:Array.isArray(e.images)?[...e.images]:e.images})),photoView:{...photoView}}}
  function renderUsage(){const root=$('#topkkuLimitLine');if(!root)return;const s=Number(vaultUsage?.savedToday||0),p=Number(vaultUsage?.publishedToday||0),sl=Number(vaultUsage?.saveLimit||limits.privateSavesPerDay),pl=Number(vaultUsage?.publishLimit||limits.publicPostsPerDay);root.textContent=`만들기·PNG 저장 무제한 · 웹 보관 ${s}/${sl} · 아지트 공개 ${p}/${pl} · 모션 장식 작품당 ${limits.motionObjects}개`}
  function renderSaveState(){const a=$('#webSaveBtn'),b=$('#publishBtn');if(a)a.disabled=saveBusy;if(b){b.disabled=saveBusy;b.textContent=currentSavedPublished?'아지트 벽에 붙음 ✓':'아지트 벽에 붙이기 ✦'}renderUsage()}
  function markDirty(){if(currentSavedId!=null){currentSavedId=null;currentSavedPublished=false;if(compositionEventKey===lastSavedEventKey)compositionEventKey=newCompositionKey();renderSaveState()}}
  function saveHistory(){markDirty();history.push(snapshot());if(history.length>30)history.shift()}
  function restore(s){if(!s)return;markDirty();theme=s.theme;elements=s.elements.map(e=>({...e}));photoView=s.photoView?{...s.photoView}:defaultPhotoView();selected=-1;$$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===theme));draw()}
  function guide(message){const root=$('#stickerGuide');if(root)root.textContent=message}
  function itemCount(id){return elements.filter(e=>e.type==='sticker'&&e.stickerId===id).length}
  function motionCount(){return elements.filter(e=>e.type==='sticker'&&itemById(e.stickerId)?.motion).length}
  function canAddItem(item){if(elements.length>=limits.totalObjects)return{ok:false,msg:`한 작품에는 최대 ${limits.totalObjects}개까지 붙일 수 있어요.`};if(item.motion&&motionCount()>=limits.motionObjects)return{ok:false,msg:`움직이는 장식은 한 작품에 ${limits.motionObjects}개까지 써요.`};if(item.maxPerCanvas&&itemCount(item.id)>=item.maxPerCanvas)return{ok:false,msg:`${item.label}은 한 작품에 ${item.maxPerCanvas}개까지 쓸 수 있어요.`};return{ok:true}}
  function addStickerItem(item){const check=canAddItem(item);if(!check.ok){guide(check.msg);return}saveHistory();const size=item.kind==='frame'?100:item.kind==='tape'?90:item.kind==='lace'?86:76;const y=item.kind==='frame'?photoBox.y+photoBox.h/2:H/2;elements.push({type:'sticker',stickerId:item.id,value:item.value||'',x:W/2,y,size,rotation:0});selected=elements.length-1;guide(`${item.label} 붙였어 ♡`);draw()}
  function addText(value,textStyle='default'){const text=String(value||'').trim();if(!text)return;if(elements.length>=limits.totalObjects){guide(`한 작품에는 최대 ${limits.totalObjects}개 오브젝트까지 붙일 수 있어요.`);return}saveHistory();elements.push({type:'text',value:text,textStyle,x:W/2,y:H-112,size:textStyle==='handwritten'?38:34,rotation:0});selected=elements.length-1;draw();$('#textInput').value=''}
  function elementRadius(e){if(e.type==='scene-filmstrip')return e.size*1.42;if(e.type==='scene-polaroid')return e.size*1.08;if(e.type==='scene-crop')return e.size*.92;if(e.type==='scene-scrap-note')return e.size*1.48;if(e.type==='scene-ticket')return e.size*1.55;if(e.type==='scene-paper-scrap')return e.size*1.15;if(e.type==='scene-tape')return e.size*.95;if(e.type==='scene-chrome')return e.size*.62;if(e.type==='scene-clip')return e.size*.70;if(e.type!=='sticker')return Math.max(e.size*1.1,String(e.value||'').length*e.size*.27);const item=itemById(e.stickerId);if(item?.kind==='frame'&&!item?.asset)return Math.max(photoBox.w,photoBox.h)*.48;return e.size*.75*Number(item?.assetScale||1)}
  function drawBackdrop(t){ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);const g=ctx.createRadialGradient(W*.18,H*.12,20,W*.18,H*.12,420);g.addColorStop(0,t.accent+'55');g.addColorStop(1,t.bg+'00');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle=t.frame;ctx.lineWidth=2;for(let y=30;y<H;y+=46){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y-18);ctx.stroke()}ctx.restore()}
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
  function blueStageIsExact(){
    return blueStageOverlayReady&&sourceMeta?.artistSlug==='8turn'&&blueStageExactFrames?.main;
  }
  function blueStageClip(poly){
    ctx.beginPath();ctx.moveTo(poly[0][0],poly[0][1]);for(let i=1;i<poly.length;i++)ctx.lineTo(poly[i][0],poly[i][1]);ctx.closePath();
  }
  function drawBlueStageExactFrame(src,poly,bounds,focusX=.5,focusY=.5,tone=.16){
    const img=src&&sceneImages.get(src);if(!img?.complete||!img.naturalWidth)return;
    ctx.save();blueStageClip(poly);ctx.clip();
    ctx.filter='contrast(1.08) saturate(1.02) brightness(.98)';
    drawStaticCoverFocus(img,bounds.x,bounds.y,bounds.w,bounds.h,focusX,focusY);
    ctx.filter='none';
    if(tone>0){
      ctx.globalCompositeOperation='soft-light';
      ctx.globalAlpha=tone;ctx.fillStyle='#1c61b8';ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    }
    ctx.restore();
  }
  function drawBlueStageExact(){
    ctx.fillStyle='#08111d';ctx.fillRect(0,0,W,H);
    const f=blueStageExactFrames||{},F=BLUE_STAGE_EXACT_FOCUS;
    drawBlueStageExactFrame(f.film1,[[46,45],[210,50],[202,218],[46,211]],{x:28,y:31,w:205,h:205},...F.film1,.12);
    drawBlueStageExactFrame(f.film2,[[43,220],[202,228],[196,399],[35,389]],{x:24,y:205,w:205,h:210},...F.film2,.12);
    drawBlueStageExactFrame(f.film3,[[32,407],[193,413],[188,566],[21,556]],{x:12,y:394,w:205,h:190},...F.film3,.12);
    drawBlueStageExactFrame(f.polaroid,[[505,42],[694,57],[661,262],[469,236]],{x:458,y:31,w:250,h:246},...F.polaroid,.16);
    drawBlueStageExactFrame(f.main,[[197,173],[560,146],[620,302],[586,544],[628,766],[544,819],[198,758],[173,543]],{x:160,y:137,w:482,h:690},...F.main,.18);
    drawBlueStageExactFrame(f.lowerFace,[[228,840],[423,815],[523,1006],[238,1051]],{x:205,y:799,w:335,h:270},...F.lowerFace,.16);
    drawBlueStageExactFrame(f.lowerStage,[[527,837],[720,867],[720,1046],[545,1027]],{x:510,y:820,w:230,h:245},...F.lowerStage,.20);
    ctx.drawImage(blueStageOverlayImage,0,0,W,H);
  }
  function drawBlueStageBackdrop(){
    ctx.fillStyle='#07101b';ctx.fillRect(0,0,W,H);
    const glow=ctx.createRadialGradient(W*.54,H*.34,36,W*.54,H*.34,560);
    glow.addColorStop(0,'rgba(22,83,178,.92)');glow.addColorStop(.42,'rgba(16,57,119,.52)');glow.addColorStop(1,'rgba(5,10,18,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    const patches=[
      [-20,-16,220,86,'#eef1f3',-.05,11,.96],[105,-6,285,72,'#27599a',.035,12,.98],[338,-12,250,90,'#0a111c',-.045,13,.99],[540,-8,205,94,'#edf0f2',.05,14,.94],
      [-25,72,150,240,'#2a5d9f',-.08,15,.96],[-24,286,142,220,'#0b111a',.045,16,.98],[-28,488,150,225,'#eef0f2',-.035,17,.90],[-18,676,160,220,'#2d5d9d',.055,18,.96],
      [604,86,145,230,'#285a99',-.05,19,.96],[610,280,140,210,'#0a111a',.045,20,.99],[610,476,150,220,'#edf0f2',-.045,21,.91],[602,664,160,225,'#285796',.055,22,.97],
      [-30,812,245,110,'#0a111a',-.035,23,.99],[72,918,286,145,'#edf0f2',.025,24,.91],[292,940,310,136,'#09101a',-.035,25,.99],[514,888,242,180,'#2b5e9e',.045,26,.98],
      [14,720,260,82,'#28589a',.03,27,.96],[460,744,280,82,'#09101a',-.04,28,.99],[4,1006,286,78,'#2b5e9e',-.025,29,.96],[420,1000,332,84,'#edf0f2',.03,30,.88],
      [132,840,190,58,'#edf0f2',-.055,31,.76],[505,836,195,60,'#2b5b9b',.05,32,.94],[215,112,170,55,'#edf0f2',-.08,33,.86],[518,320,160,52,'#2c5d9f',.07,34,.88],[250,770,220,48,'#edf0f2',-.04,35,.80]
    ];
    patches.forEach(p=>drawTornPatch(...p));
    ctx.save();ctx.globalAlpha=.34;ctx.strokeStyle='#f5f7fb';ctx.lineWidth=1.25;
    for(let i=0;i<140;i++){const x=stageNoise(100+i)*W,y=stageNoise(300+i)*H,len=8+stageNoise(500+i)*56;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+len,y+(stageNoise(700+i)-.5)*15);ctx.stroke()}
    ctx.globalAlpha=.13;ctx.fillStyle='#fff';for(let i=0;i<180;i++){const x=stageNoise(900+i)*W,y=stageNoise(1200+i)*H,r=.45+stageNoise(1500+i)*1.7;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
    ctx.globalAlpha=.52;ctx.strokeStyle='#f7fbff';ctx.lineWidth=2.2;
    for(const [x1,y1,x2,y2] of [[72,95,123,62],[560,353,646,310],[575,625,658,582],[282,850,347,816],[500,870,575,836],[240,1010,338,980]]){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x1+16,y2+18);ctx.lineTo(x2-8,y1+20);ctx.stroke()}
    ctx.restore();
  }
  function drawBlueStageMain(){
    const m=BLUE_STAGE.main,{x,y,w,h}=m;
    drawTornPatch(x-18,y-18,w+40,h+40,'#f0f1ef',-.010,71,.96);
    drawTornPatch(x-10,y-10,w+22,h+22,'#285b9a',.012,72,.96);
    ctx.save();tornPaperPath(x,y,w,h,73,16,9);ctx.clip();
    const mainImg=(blueStageMainSrc&&sceneImages.get(blueStageMainSrc))||photo;
    if(mainImg?.complete&&mainImg.naturalWidth){
      drawStaticCoverFocus(mainImg,x,y,w,h,m.focusX,m.focusY);
      const wash=ctx.createLinearGradient(x,y,x+w,y+h);wash.addColorStop(0,'rgba(14,45,96,.02)');wash.addColorStop(.68,'rgba(5,20,45,.01)');wash.addColorStop(1,'rgba(4,12,28,.12)');ctx.fillStyle=wash;ctx.fillRect(x,y,w,h);
    }else{ctx.fillStyle='#18263c';ctx.fillRect(x,y,w,h)}
    ctx.restore();
    drawTornPatch(x-15,y+h-20,w*.73,34,'#f0f1ef',-.018,74,.92);
    drawTornPatch(x+w*.55,y-10,w*.40,28,'#24558f',.026,75,.96);
  }
  function drawFrame(t){ctx.save();ctx.shadowColor='rgba(0,0,0,.20)';ctx.shadowBlur=28;ctx.shadowOffsetY=18;roundedPath(photoBox.x-24,photoBox.y-24,photoBox.w+48,photoBox.h+48,46);ctx.fillStyle=t.paper;ctx.fill();ctx.restore();ctx.save();roundedPath(photoBox.x,photoBox.y,photoBox.w,photoBox.h,photoBox.r);ctx.clip();if(photo)drawPhoto(photo,photoBox.x,photoBox.y,photoBox.w,photoBox.h);else{ctx.fillStyle=theme==='midnight'?'#313044':'#f4f1f7';ctx.fillRect(photoBox.x,photoBox.y,photoBox.w,photoBox.h);ctx.fillStyle=theme==='midnight'?'#aba5c6':'#90899b';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 28px system-ui,sans-serif';ctx.fillText('최애 사진을 올려주세요 ♡',W/2,H/2-8);ctx.font='500 17px system-ui,sans-serif';ctx.fillText('사진은 이 브라우저 밖으로 나가지 않아요',W/2,H/2+34)}ctx.restore();ctx.save();roundedPath(photoBox.x-11,photoBox.y-11,photoBox.w+22,photoBox.h+22,38);ctx.strokeStyle=t.frame;ctx.lineWidth=12;ctx.stroke();ctx.restore()}
  function drawStaticCover(img,x,y,w,h){if(!img?.naturalWidth||!img?.naturalHeight)return;const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
  function drawStaticCoverFocus(img,x,y,w,h,focusX=.5,focusY=.5){
    if(!img?.naturalWidth||!img?.naturalHeight)return;
    const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
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
    if(item.kind==='tape'){const w=s*1.65,h=s*.48;ctx.globalAlpha=.86;ctx.fillStyle=item.variant==='pink'?'#ffb7d5':item.variant==='lilac'?'#d9c5ff':item.variant==='blue'?'#7299dc':gradient([[0,'#ffc1df'],[.2,'#bfe8ff'],[.45,'#d7c3ff'],[.7,'#fff0ae'],[1,'#ffc7ec']],-w/2,0,w/2,0);ctx.fillRect(-w/2,-h/2,w,h);ctx.globalAlpha=.35;ctx.strokeStyle='#fff';ctx.lineWidth=3;for(let x=-w/2;x<w/2;x+=18){ctx.beginPath();ctx.moveTo(x,-h/2);ctx.lineTo(x+18,h/2);ctx.stroke()}ctx.globalAlpha=1;return}
    if(item.kind==='paper'){const date=item.variant==='date',w=s*(date?1.9:1.5),h=s*(date?0.48:1.05);ctx.shadowColor='rgba(50,35,65,.18)';ctx.shadowBlur=8;ctx.fillStyle=item.variant==='ticket'?'#fff0d7':date?'#e5ecfb':'#fffaf0';roundedPath(-w/2,-h/2,w,h,date?3:8);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(99,75,120,.22)';ctx.lineWidth=2;ctx.stroke();if(item.variant==='ticket'){ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(-w*.28,-h*.35);ctx.lineTo(-w*.28,h*.35);ctx.stroke();ctx.setLineDash([])}if(date){ctx.fillStyle='#304b78';ctx.font=`700 ${Math.max(10,s*.16)}px ui-monospace,monospace`;ctx.fillText(String(e.value||'DATE').slice(0,24),0,0)}return}
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
  function draw(now=performance.now()){const t=themes[theme];ctx.clearRect(0,0,W,H);const exact=theme==='stageblue'&&blueStageIsExact();if(exact)drawBlueStageExact();else if(theme==='stageblue'){drawBlueStageBackdrop();drawBlueStageMain()}else{drawBackdrop(t);drawFrame(t)}if(!exact)elements.forEach((e,i)=>drawElement(e,i,t,now));$('#selectionState').textContent=statusText()}
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
  function previewGlyph(item){if(item.kind==='emoji')return item.value;return{tape:'▰',paper:'▤',pearl:'○',gem:'◆',chrome:item.variant==='heart'?'♡':'★',jelly:'♥',lace:'⌜',acrylic:'◉',frame:'▣',sparkle:'✦'}[item.kind]||'✦'}
  function renderStickerProfile(){const root=$('#stickerProfile');if(!root)return;const identity=window.NUGU_AUTH?.getIdentitySync?.();if(!identity?.authenticated){root.innerHTML='<b>기본 꾸미기는 바로 가능 ♡</b><span>로그인하면 놀았던 방식대로 잎과 덕질 결이 자라요.</span>';return}const p=styleState?.profile;if(!p){root.innerHTML='<b>꾸미기 서랍 불러오는 중…</b><span>지금까지의 덕질 기록을 살펴보고 있어요.</span>';return}const trait=p.traits?.primary?.label||'둘러보는 중',secondary=(p.traits?.secondary||[]).map(x=>x.label).join(' · ');root.innerHTML=`<div class="growth-profile-line">${leafMark(p)}<div><b>${esc(p.growth?.title||'반가운 새잎')} · ${esc(trait)}</b><span>${secondary?esc(secondary)+' · ':''}사용 가능한 활동포인트 ${Number(p.points?.balance||0)}P</span></div></div>`}
  function renderStickerGrid(){const root=$('#stickerGrid');if(!root)return;const rows=catalog.items.filter(item=>{const a=accessFor(item);return a.visible&&(activeStickerPack==='all'||item.pack===activeStickerPack)});root.innerHTML=rows.length?rows.map(item=>{const a=accessFor(item),motion=item.motion&&!reducedMotion,visual=item.asset?`<img src="${esc(item.asset)}" alt="" loading="lazy" draggable="false">`:esc(previewGlyph(item));return `<button type="button" class="material-sticker ${a.unlocked?'':'locked'} ${a.gifted?'gifted-item':''} ${motion?'motion-item':''}" data-sticker-id="${esc(item.id)}" title="${esc(item.label)}"><span class="sticker-swatch kind-${esc(item.kind)} variant-${esc(item.variant||'base')} ${item.asset?'has-asset':''}">${visual}</span><b>${esc(item.label)}</b><small>${a.unlocked?(a.gifted?'🎁 선물받음':motion?'LIVE ✦':'사용 가능'):`🔒 ${esc(a.label)}`}</small></button>`}).join(''):'<div class="sticker-empty-band">지금 이 서랍에서 꺼낼 수 있는 꾸미기는 여기까지예요. ♡</div>';root.querySelectorAll('[data-sticker-id]').forEach(b=>b.onclick=()=>handleStickerClick(b.dataset.stickerId))}
  async function signedIdentity(message='이 기능은 로그인 후 사용할 수 있어요.'){let identity=null;try{identity=await window.NUGU_AUTH?.getIdentity?.()}catch{}if(identity?.authenticated&&identity.accessToken)return identity;const state=$('#webSaveState');if(state)state.textContent=message;window.NUGU_AUTH_UI?.signIn?.(location.href);return null}
  async function unlockSticker(item){const identity=await signedIdentity('희귀 스티커는 로그인 후 영구 해금할 수 있어요.');if(!identity)return;const balance=Number(styleState?.profile?.points?.balance||0);if(balance<Number(item.unlockCost||0)){guide(`${item.label}은 ${item.unlockCost}P가 필요해요. 지금은 ${balance}P 있어요.`);return}guide(`${item.label} 영구 해금 중…`);try{const r=await fetch(`${apiBase()}/api/v1/community/style/unlock/${encodeURIComponent(item.id)}`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',...(window.NUGU_AUTH?.authHeaders?.(identity)||{})},body:JSON.stringify({visitorId:identity.visitorId})});const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data.error||'unlock_failed'),{code:data.error});styleState={profile:data.profile,items:data.items};renderStickerProfile();renderStickerGrid();emitStyleState();guide(`${item.label} 영구 해금 완료 ♡ 이제 횟수 차감 없이 계속 쓸 수 있어요.`)}catch(e){guide(e.code==='insufficient_style_points'?'포인트가 조금 부족해요. 덕질하다 보면 자연스럽게 쌓여요.':'지금은 해금하지 못했어요.')}}
  async function handleStickerClick(id){const item=itemById(id);if(!item)return;const access=accessFor(item);if(!access.unlocked){if(item.access==='points'){await unlockSticker(item);return}const identity=window.NUGU_AUTH?.getIdentitySync?.();if(!identity?.authenticated){await signedIdentity('꾸미기 서랍은 로그인 후 덕질 기록과 연결돼요.');return}guide('조금 더 놀다 보면 다음 꾸미기 서랍이 편지와 함께 열려요. ♡');return}if(item.asset){try{await ensureAsset(item)}catch{guide(`${item.label} 벡터 장식을 불러오지 못했어요. 다시 눌러줘.`);return}}addStickerItem(item)}
  async function loadStyleState(){const sync=window.NUGU_AUTH?.getIdentitySync?.();if(!sync?.authenticated){styleState=null;renderStickerProfile();renderStickerGrid();emitStyleState();return}try{const identity=await window.NUGU_AUTH.getIdentity();if(!identity?.authenticated)return;const r=await fetch(`${apiBase()}/api/v1/community/style/me?visitorId=${encodeURIComponent(identity.visitorId)}`,{headers:{Accept:'application/json',...(window.NUGU_AUTH?.authHeaders?.(identity)||{})},cache:'no-store'});const data=await r.json();if(!r.ok)throw new Error(data.error||'style_failed');styleState=data}catch(e){console.warn('style state',e);styleState=null}renderStickerProfile();renderStickerGrid();emitStyleState()}
  function sceneCutsReady(){return sourceMeta?.source==='watch'&&sourceMeta?.videoOnly===true&&sourceMeta?.manualCapture!==true&&!!String(sourceMeta?.videoId||'').trim()&&!!sourceMeta?.image&&!!apiBase()}
  function renderSceneCutAvailability(){const ok=sceneCutsReady();for(const id of ['addFilmStrip','addPolaroidCut','buildBlueStage']){const b=$('#'+id);if(b){b.disabled=!ok;b.title=ok?(id==='buildBlueStage'?'현재 Watch 장면을 실제 Topkku 오브젝트로 Blue Stage 구성합니다.':'같은 Watch 영상의 인접 프레임을 가져옵니다.'):'Watch에서 가져온 장면에서 사용할 수 있어요.'}}}
  async function fetchWatchSceneFrame(at){
    const videoId=String(sourceMeta?.videoId||'').trim(),base=apiBase(),time=Math.max(0,Number(at)||0);
    if(!videoId||!base)throw new Error('watch_scene_unavailable');
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),28000);
    try{
      const r=await fetch(base+'/api/v1/media/youtube-frame',{method:'POST',headers:{'Content-Type':'application/json',Accept:'image/jpeg'},body:JSON.stringify({videoId,time}),signal:ac.signal});
      if(!r.ok)throw new Error('related_frame_failed');
      const blob=await r.blob(),image=await blobDataUrl(blob);
      const width=Number(r.headers.get('X-NUGU-Frame-Width')||0),height=Number(r.headers.get('X-NUGU-Frame-Height')||0),capturedTime=Number(r.headers.get('X-NUGU-Frame-Time')||time);
      if(!image||width<64||height<64)throw new Error('related_frame_invalid');
      await ensureSceneImage(image);return{image,width,height,time:capturedTime};
    }finally{clearTimeout(timer)}
  }
  async function addFilmStripFromWatch(){
    if(!sceneCutsReady()){guide('필름 3컷은 Watch에서 가져온 실제 영상 장면으로 시작할 때 만들 수 있어요.');return}
    if(elements.length>=limits.totalObjects){guide(`한 작품에는 최대 ${limits.totalObjects}개까지 붙일 수 있어요.`);return}
    const base=Math.max(0,Number(sourceMeta.time)||0);guide('같은 영상의 바로 앞·뒤 장면을 가져오는 중…');
    try{
      await ensureSceneImage(sourceMeta.image);
      const before=await fetchWatchSceneFrame(Math.max(0,base-.45));const after=await fetchWatchSceneFrame(base+.45);
      saveHistory();elements.push({type:'scene-filmstrip',images:[before.image,sourceMeta.image,after.image],label:String(sourceMeta.artist||'FILM 400'),x:105,y:360,size:132,rotation:-.035});selected=elements.length-1;guide('같은 순간의 앞·현재·뒤 프레임을 필름 3컷으로 붙였어 ♡');draw();
    }catch(e){console.warn('film strip scene cuts',e);guide('같은 영상의 인접 프레임을 가져오지 못했어요. 메인 장면은 그대로 유지돼요.')}
  }
  async function addPolaroidFromWatch(){
    if(!sceneCutsReady()){guide('폴라로이드 컷은 Watch에서 가져온 실제 영상 장면으로 시작할 때 만들 수 있어요.');return}
    if(elements.length>=limits.totalObjects){guide(`한 작품에는 최대 ${limits.totalObjects}개까지 붙일 수 있어요.`);return}
    const base=Math.max(0,Number(sourceMeta.time)||0);guide('같은 영상에서 폴라로이드로 남길 인접 장면을 가져오는 중…');
    try{
      const shot=await fetchWatchSceneFrame(base+.65);saveHistory();elements.push({type:'scene-polaroid',image:shot.image,caption:'favorite cut ♡',x:W-122,y:190,size:122,rotation:.055});selected=elements.length-1;guide('같은 영상의 인접 장면을 폴라로이드로 붙였어 ♡');draw();
    }catch(e){console.warn('polaroid scene cut',e);guide('폴라로이드용 인접 프레임을 가져오지 못했어요. 메인 장면은 그대로 유지돼요.')}
  }
  function presetSticker(id,fallbackId,props={}){
    const candidates=[id,fallbackId].filter(Boolean);
    for(const candidate of candidates){
      const item=itemById(candidate);if(!item)continue;
      const access=accessFor(item);if(!access.unlocked)continue;
      return {type:'sticker',stickerId:item.id,value:props.value??item.value??'',x:props.x??W/2,y:props.y??H/2,size:props.size??(item.kind==='tape'?90:76),rotation:props.rotation??0,preset:'blue-stage'};
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
    if(!sceneCutsReady()){guide('Blue Stage 조립은 Watch에서 가져온 실제 영상 장면으로 시작할 때 사용할 수 있어요.');return}
    const button=$('#buildBlueStage');if(button?.disabled)return;
    const base=Math.max(0,Number(sourceMeta.time)||0),artistLabel=String(sourceMeta.artist||'8TURN').trim().slice(0,14)||'8TURN';
    if(button){button.disabled=true;button.textContent='장면 정밀 매칭 중…'}
    guide('원 시안 좌표에 맞춰 메인컷·필름·폴라로이드·메모·티켓을 정밀 조립하는 중…');
    try{
      await ensureSceneImage(sourceMeta.image);
      const exactRoleFrames=await fetchBlueStageExactRoleFrames().catch(e=>{console.warn('blue stage exact role frames',e);return null});
      let mainSrc,alt1,alt2,alt3,ranked=[];
      if(exactRoleFrames){
        blueStageExactFrames=exactRoleFrames;
        mainSrc=exactRoleFrames.main;alt1=exactRoleFrames.polaroid;alt2=exactRoleFrames.lowerFace;alt3=exactRoleFrames.lowerStage;
        blueStageMainSrc=mainSrc;
      }else{
        const fetched=[];for(const off of [-1.20,-.58,.58,1.20])fetched.push(await fetchWatchSceneFrame(Math.max(0,base+off)));
        ranked=await pickBlueStageFrames([sourceMeta.image,...fetched.map(x=>x.image)]);
        mainSrc=ranked[0]||sourceMeta.image;alt1=ranked[1]||fetched[2]?.image||sourceMeta.image;alt2=ranked[2]||fetched[0]?.image||sourceMeta.image;alt3=ranked[3]||fetched[3]?.image||alt1;
        blueStageMainSrc=mainSrc;await ensureSceneImage(mainSrc);
        const exactCandidates=[mainSrc,alt1,alt2,alt3,...ranked].filter(Boolean);
        for(const src of [...new Set(exactCandidates)])await ensureSceneImage(src);
        blueStageExactFrames={main:mainSrc,film1:alt1,film2:alt2,film3:alt3,polaroid:alt1,lowerFace:alt2,lowerStage:alt3};
      }
      const B=BLUE_STAGE,date=String(capturedDateLabel()||'').replaceAll(' · ','  ');
      const additions=[
        {type:'scene-paper-scrap',x:350,y:80,size:92,aspect:2.45,color:'#f2f0ea',rotation:-.055,seed:101,preset:'blue-stage'},
        {type:'scene-filmstrip',images:exactRoleFrames?[exactRoleFrames.film1,exactRoleFrames.film2,exactRoleFrames.film3]:[alt1,alt2,alt3],label:'KODAK 400',artistLabel:artistLabel.toUpperCase(),x:B.film.x,y:B.film.y,size:B.film.size,rotation:B.film.rotation,preset:'blue-stage'},
        {type:'scene-polaroid',image:exactRoleFrames?.polaroid||alt1,caption:'favorite cut ♡',x:B.polaroid.x,y:B.polaroid.y,size:B.polaroid.size,rotation:B.polaroid.rotation,preset:'blue-stage'},
        {type:'scene-paper-scrap',x:632,y:430,size:86,aspect:1.12,color:'#f4f2ea',rotation:-.060,seed:102,lines:true,preset:'blue-stage'},
        {type:'scene-paper-scrap',x:646,y:650,size:118,aspect:1.18,color:'#f2f0e9',rotation:-.050,seed:103,lines:false,preset:'blue-stage'},
        {type:'scene-ticket',value:artistLabel.toUpperCase(),detail:`DATE  ${date}\nAREA  STAGE\nSEAT  08`,x:B.ticket.x,y:B.ticket.y,size:B.ticket.size,rotation:B.ticket.rotation,preset:'blue-stage'},
        {type:'scene-scrap-note',lines:['Same moment','Different feelings',"You're always",'my special one. ♡'],x:B.note.x,y:B.note.y,size:B.note.size,rotation:B.note.rotation,preset:'blue-stage'},
        {type:'scene-crop',image:exactRoleFrames?.lowerFace||alt2,x:B.lowerFace.x,y:B.lowerFace.y,size:B.lowerFace.size,aspect:B.lowerFace.aspect,focusX:B.lowerFace.focusX,focusY:B.lowerFace.focusY,rotation:B.lowerFace.rotation,preset:'blue-stage'},
        {type:'scene-crop',image:exactRoleFrames?.lowerStage||alt3,x:B.lowerStage.x,y:B.lowerStage.y,size:B.lowerStage.size,aspect:B.lowerStage.aspect,focusX:B.lowerStage.focusX,focusY:B.lowerStage.focusY,rotation:B.lowerStage.rotation,preset:'blue-stage'},
        {type:'scene-tape',x:150,y:38,size:86,rotation:-.14,variant:'blue',seed:111,preset:'blue-stage'},
        {type:'scene-tape',x:540,y:36,size:76,rotation:.08,variant:'blue',seed:112,preset:'blue-stage'},
        {type:'scene-tape',x:84,y:573,size:72,rotation:.12,variant:'blue',seed:113,preset:'blue-stage'},
        {type:'scene-tape',x:654,y:548,size:70,rotation:-.12,variant:'blue',seed:114,preset:'blue-stage'},
        {type:'scene-tape',x:262,y:804,size:84,rotation:-.02,variant:'blue',seed:115,preset:'blue-stage'},
        {type:'scene-tape',x:560,y:822,size:80,rotation:.08,variant:'blue',seed:116,preset:'blue-stage'},
        {type:'scene-tape',x:88,y:1010,size:78,rotation:-.09,variant:'blue',seed:117,preset:'blue-stage'},
        {type:'scene-tape',x:340,y:1032,size:84,rotation:.04,variant:'black',seed:118,preset:'blue-stage'},
        {type:'scene-tape',x:474,y:1024,size:70,rotation:-.08,variant:'blue',seed:119,preset:'blue-stage'},
        {type:'scene-tape',x:650,y:1000,size:68,rotation:.08,variant:'white',seed:120,preset:'blue-stage'},
        {type:'scene-chrome',variant:'star',x:466,y:100,size:50,rotation:.14,preset:'blue-stage'},
        {type:'scene-clip',x:690,y:76,size:66,rotation:.12,preset:'blue-stage'},
        {type:'scene-chrome',variant:'heart',x:660,y:276,size:66,rotation:-.12,preset:'blue-stage'},
        {type:'scene-chrome',variant:'star',x:650,y:388,size:46,rotation:.18,preset:'blue-stage'},
        {type:'scene-chrome',variant:'star',x:490,y:870,size:50,rotation:-.10,preset:'blue-stage'},
        {type:'scene-chrome',variant:'heart',x:40,y:800,size:40,rotation:.08,preset:'blue-stage'},
        {type:'scene-chrome',variant:'star',x:220,y:720,size:36,rotation:.18,preset:'blue-stage'},
        {type:'scene-chrome',variant:'star',x:438,y:1018,size:38,rotation:-.18,preset:'blue-stage'},
        {type:'text',value:capturedDateLabel(),textStyle:'date-label',x:B.date.x,y:B.date.y,size:B.date.size,rotation:B.date.rotation,preset:'blue-stage'},
        {type:'text',value:'my pick ♡',textStyle:'handwritten',x:B.pick.x,y:B.pick.y,size:B.pick.size,rotation:B.pick.rotation,preset:'blue-stage'},
        {type:'text',value:'saved\ntonight!',textStyle:'handwritten',x:B.saved.x,y:B.saved.y,size:B.saved.size,rotation:B.saved.rotation,preset:'blue-stage'},
        {type:'text',value:artistLabel.toUpperCase()+' ♡',textStyle:'handwritten',x:B.artistNote.x,y:B.artistNote.y,size:B.artistNote.size,rotation:B.artistNote.rotation,preset:'blue-stage'}
      ];
      const retained=elements.filter(e=>e.preset!=='blue-stage');
      if(retained.length+additions.length>limits.totalObjects)throw new Error('preset_object_limit');
      saveHistory();elements=[...retained,...additions];theme='stageblue';photoView={zoom:1,x:0,y:0};selected=-1;
      $$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme==='stageblue'));
      guide(blueStageIsExact()?'Blue Stage 원본 시안 오버레이 매칭 완료 · 실제 영상 프레임을 원본 사진창에 합성했어.':'Blue Stage 원 시안 좌표 매칭 완료 · 메인 장면은 인접 프레임 중 얼굴/블루톤/선명도 기준으로 자동 선택했어.');
      draw();
    }catch(e){
      console.warn('blue stage reconstruction',e);blueStageMainSrc='';blueStageExactFrames=null;
      guide(e.message==='preset_object_limit'?'현재 장식이 많아서 Blue Stage 조각을 한 번에 더 붙일 수 없어요.':'같은 영상의 인접 장면을 가져오지 못해서 Blue Stage 조립을 시작하지 않았어요.');
    }finally{if(button){button.disabled=!sceneCutsReady();button.textContent='Blue Stage 조립'}}
  }
  function setArtist(artist){const next=artist?.slug?{slug:String(artist.slug).toLowerCase(),name:String(artist.name||artist.korean_name||artist.slug)}:null;if(selectedArtist?.slug!==next?.slug)markDirty();selectedArtist=next;const box=$('#topkkuArtistConnected');if(box)box.innerHTML=selectedArtist?`<b>${esc(selectedArtist.name)}</b><span>웹 보관함과 아지트 공개 대상을 이 팀으로 연결했어요.</span>`:'아직 팀이 연결되지 않았어요.';const results=$('#topkkuArtistResults');if(results)results.innerHTML='';const input=$('#topkkuArtistSearch');if(input&&selectedArtist)input.value=selectedArtist.name}
  function loadPhotoData(src,meta=null){if(!src)return;blueStageMainSrc='';blueStageExactFrames=null;const img=new Image();img.onload=()=>{photo=img;photoView=defaultPhotoView();sourceMeta=meta;configurePhotoBox(img,meta);compositionEventKey=newCompositionKey();currentSavedId=null;currentSavedPublished=false;lastSavedEventKey='';if(meta?.artistSlug)setArtist({slug:meta.artistSlug,name:meta.artist||meta.artistSlug});selected=-1;renderSceneCutAvailability();draw();renderSaveState()};img.onerror=()=>{sourceMeta=null;resetPhotoBox();compositionEventKey='';renderSceneCutAvailability();draw()};img.src=src}
  function loadIncoming(){let raw='';try{raw=sessionStorage.getItem('nuguTopkkuIncoming')||'';sessionStorage.removeItem('nuguTopkkuIncoming')}catch{}if(!raw)return false;try{const data=JSON.parse(raw);if(!data?.image)return false;loadPhotoData(data.image,data);return true}catch{return false}}
  canvas.addEventListener('pointerdown',ev=>{const p=canvasPoint(ev),i=hitTest(p);selected=i;if(i>=0){markDirty();drag={dx:p.x-elements[i].x,dy:p.y-elements[i].y,before:{...elements[i]}};canvas.setPointerCapture?.(ev.pointerId)}draw()});
  canvas.addEventListener('pointermove',ev=>{if(!drag||selected<0)return;const p=canvasPoint(ev),e=elements[selected];e.x=clamp(p.x-drag.dx,24,W-24);e.y=clamp(p.y-drag.dy,24,H-24);draw()});
  canvas.addEventListener('pointerup',()=>{if(drag&&selected>=0){const before=drag.before,after=elements[selected];if(before.x!==after.x||before.y!==after.y){history.push({theme,elements:elements.map((e,i)=>i===selected?{...before}:{...e}),photoView:{...photoView}});if(history.length>30)history.shift()}}drag=null});
  $('#photoInput').addEventListener('change',ev=>{const file=ev.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>loadPhotoData(reader.result,null);reader.readAsDataURL(file)});
  function editPhoto(fn){if(!photo)return;saveHistory();fn(photoView);selected=-1;draw()}
  $('#photoZoomOut').onclick=()=>editPhoto(v=>v.zoom=clamp(v.zoom/1.12,1,3));$('#photoZoomIn').onclick=()=>editPhoto(v=>v.zoom=clamp(v.zoom*1.12,1,3));$('#photoLeft').onclick=()=>editPhoto(v=>v.x-=34);$('#photoRight').onclick=()=>editPhoto(v=>v.x+=34);$('#photoUp').onclick=()=>editPhoto(v=>v.y-=34);$('#photoDown').onclick=()=>editPhoto(v=>v.y+=34);$('#photoCenter').onclick=()=>editPhoto(v=>{v.zoom=1;v.x=0;v.y=0});
  $$('#themeGrid [data-theme]').forEach(b=>b.addEventListener('click',()=>{if(theme===b.dataset.theme)return;saveHistory();theme=b.dataset.theme;$$('[data-theme]').forEach(x=>x.classList.toggle('active',x===b));draw()}));
  $$('#stickerPackTabs [data-sticker-pack]').forEach(b=>b.addEventListener('click',()=>{activeStickerPack=b.dataset.stickerPack;$$('#stickerPackTabs [data-sticker-pack]').forEach(x=>x.classList.toggle('active',x===b));renderStickerGrid()}));
  $('#addText').addEventListener('click',()=>addText($('#textInput').value));$('#textInput').addEventListener('keydown',e=>{if(e.key==='Enter')addText(e.currentTarget.value)});
  $$('.quick-copy [data-copy]').forEach(b=>b.addEventListener('click',()=>addText(b.dataset.copy,b.dataset.textStyle||'default')));
  $('#addFilmStrip')?.addEventListener('click',()=>addFilmStripFromWatch());$('#addPolaroidCut')?.addEventListener('click',()=>addPolaroidFromWatch());$('#buildBlueStage')?.addEventListener('click',()=>buildBlueStageReconstruction());
  function editSelected(fn){if(selected<0)return;saveHistory();fn(elements[selected]);draw()}
  $('#smaller').onclick=()=>editSelected(e=>e.size=clamp(e.size*.88,18,180));$('#bigger').onclick=()=>editSelected(e=>e.size=clamp(e.size*1.12,18,180));$('#rotateLeft').onclick=()=>editSelected(e=>e.rotation-=Math.PI/18);$('#rotateRight').onclick=()=>editSelected(e=>e.rotation+=Math.PI/18);$('#deleteElement').onclick=()=>{if(selected<0)return;saveHistory();elements.splice(selected,1);selected=-1;draw()};
  $('#undoBtn').onclick=()=>restore(history.pop());
  $('#resetBtn').onclick=()=>{if(!photo&&!elements.length&&theme==='lavender')return;saveHistory();photo=null;blueStageMainSrc='';blueStageExactFrames=null;photoView=defaultPhotoView();sourceMeta=null;resetPhotoBox();compositionEventKey='';elements=[];selected=-1;theme='lavender';currentSavedId=null;currentSavedPublished=false;lastSavedEventKey='';setArtist(null);renderSceneCutAvailability();$$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme==='lavender'));$('#photoInput').value='';draw();renderSaveState()};
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
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',...(window.NUGU_AUTH?.authHeaders?.(identity)||{})},body:JSON.stringify({visitorId:identity.visitorId,eventKey:key,imageData:canvasPngData(),source:sourceMeta?.source==='watch'?'watch-topkku':'topkku',sourceContentUrl:sourceMeta?.contentUrl||'',sourceTitle:sourceMeta?.title||'',objectCount:elements.length,stickerIds:stickerIds(),effects:motionEffects(),referenceEventKey:referenceSource?.eventKey||''})});
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
  window.__NUGU_TOPKKU_FRAME_STATE__=()=>({photoBox:{...photoBox},source:sourceMeta?.source||'',sourceSize:photo?{width:photo.naturalWidth,height:photo.naturalHeight}:null,zoom:photoView.zoom});
  window.addEventListener('nugu-auth-changed',()=>{loadStyleState();loadVault()});
  window.NUGU_TOPKKU_LOAD_VAULT=loadVault;window.NUGU_TOPKKU_LOAD_STYLE=loadStyleState;window.NUGU_TOPKKU_API_BASE=apiBase;$('#versionLabel').textContent=(window.NUGU_CONFIG||{}).build||'Updated 2026.09.12';preloadStickerAssets();setArtist(null);loadReferenceSource();renderStickerProfile();renderStickerGrid();renderSaveState();renderSceneCutAvailability();draw();requestAnimationFrame(animationLoop);const incoming=loadIncoming();if(!incoming)loadArtistFromQuery();loadStyleState();loadVault();
})();

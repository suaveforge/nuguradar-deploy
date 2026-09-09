(()=>{
  const canvas=document.getElementById('topkkuCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  const photoBox={x:96,y:126,w:528,h:792,r:30};
  const themes={
    lavender:{bg:'#eee9ff',ink:'#57468b',frame:'#b9a8f5',accent:'#ff86bb',paper:'#fffdf8'},
    pink:{bg:'#ffe8f1',ink:'#8a4564',frame:'#ff9dc4',accent:'#ffc55f',paper:'#fffaf7'},
    mint:{bg:'#e7fff5',ink:'#3d7563',frame:'#8fe6c2',accent:'#8da4ff',paper:'#fbfffd'},
    midnight:{bg:'#171724',ink:'#f1ecff',frame:'#6d5ba8',accent:'#ff6cac',paper:'#252436'}
  };
  let theme='lavender',photo=null,elements=[],selected=-1,drag=null,history=[];
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function roundedPath(x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
  function coverImage(img,x,y,w,h){const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
  function saveHistory(){history.push({theme,elements:elements.map(e=>({...e}))});if(history.length>30)history.shift()}
  function restore(s){if(!s)return;theme=s.theme;elements=s.elements.map(e=>({...e}));selected=-1;$$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===theme));draw()}
  function addSticker(char){saveHistory();elements.push({type:'sticker',value:char,x:W/2,y:H/2,size:76,rotation:0});selected=elements.length-1;draw()}
  function addText(value){const text=String(value||'').trim();if(!text)return;saveHistory();elements.push({type:'text',value:text,x:W/2,y:H-112,size:34,rotation:0});selected=elements.length-1;draw();$('#textInput').value=''}
  function elementRadius(e){if(e.type==='sticker')return e.size*.65;return Math.max(e.size*1.1,e.value.length*e.size*.27)}
  function drawBackdrop(t){ctx.fillStyle=t.bg;ctx.fillRect(0,0,W,H);const g=ctx.createRadialGradient(W*.18,H*.12,20,W*.18,H*.12,420);g.addColorStop(0,t.accent+'55');g.addColorStop(1,t.bg+'00');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle=t.frame;ctx.lineWidth=2;for(let y=30;y<H;y+=46){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y-18);ctx.stroke()}ctx.restore()}
  function drawFrame(t){ctx.save();ctx.shadowColor='rgba(0,0,0,.20)';ctx.shadowBlur=28;ctx.shadowOffsetY=18;roundedPath(photoBox.x-24,photoBox.y-24,photoBox.w+48,photoBox.h+48,46);ctx.fillStyle=t.paper;ctx.fill();ctx.restore();ctx.save();roundedPath(photoBox.x,photoBox.y,photoBox.w,photoBox.h,photoBox.r);ctx.clip();if(photo)coverImage(photo,photoBox.x,photoBox.y,photoBox.w,photoBox.h);else{ctx.fillStyle=theme==='midnight'?'#313044':'#f4f1f7';ctx.fillRect(photoBox.x,photoBox.y,photoBox.w,photoBox.h);ctx.fillStyle=theme==='midnight'?'#aba5c6':'#90899b';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 28px system-ui,sans-serif';ctx.fillText('최애 사진을 올려주세요 ♡',W/2,H/2-8);ctx.font='500 17px system-ui,sans-serif';ctx.fillText('사진은 이 브라우저 밖으로 나가지 않아요',W/2,H/2+34)}ctx.restore();ctx.save();roundedPath(photoBox.x-11,photoBox.y-11,photoBox.w+22,photoBox.h+22,38);ctx.strokeStyle=t.frame;ctx.lineWidth=12;ctx.stroke();ctx.restore();ctx.fillStyle=t.ink;ctx.font='900 20px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText('NUGU RADAR · TOPKKU',48,58);ctx.textAlign='right';ctx.fillText('♡ made by a fan',W-48,H-45)}
  function drawElement(e,i,t){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.rotation);ctx.textAlign='center';ctx.textBaseline='middle';if(e.type==='sticker'){ctx.font=`${e.size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;ctx.fillText(e.value,0,0)}else{ctx.font=`800 ${e.size}px system-ui,-apple-system,"Segoe UI",sans-serif`;ctx.lineWidth=Math.max(3,e.size*.16);ctx.strokeStyle=theme==='midnight'?'#171724':'#fffdf8';ctx.strokeText(e.value,0,0);ctx.fillStyle=t.ink;ctx.fillText(e.value,0,0)}if(i===selected){const r=elementRadius(e);ctx.strokeStyle='#7ff6c2';ctx.lineWidth=3;ctx.setLineDash([9,7]);ctx.strokeRect(-r,-r*.58,r*2,r*1.16);ctx.setLineDash([])}ctx.restore()}
  function draw(){const t=themes[theme];ctx.clearRect(0,0,W,H);drawBackdrop(t);drawFrame(t);elements.forEach((e,i)=>drawElement(e,i,t));$('#selectionState').textContent=selected>=0?'선택됨 · 드래그해서 옮기고 아래 버튼으로 조절하세요':photo?'스티커나 문구를 추가해보세요':'사진을 먼저 골라주세요'}
  function canvasPoint(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height}}
  function hitTest(p){for(let i=elements.length-1;i>=0;i--){const e=elements[i],r=elementRadius(e);if(Math.hypot(p.x-e.x,p.y-e.y)<=r*1.05)return i}return-1}
  canvas.addEventListener('pointerdown',ev=>{const p=canvasPoint(ev),i=hitTest(p);selected=i;if(i>=0){drag={dx:p.x-elements[i].x,dy:p.y-elements[i].y,before:{...elements[i]}};canvas.setPointerCapture?.(ev.pointerId)}draw()});
  canvas.addEventListener('pointermove',ev=>{if(!drag||selected<0)return;const p=canvasPoint(ev),e=elements[selected];e.x=clamp(p.x-drag.dx,24,W-24);e.y=clamp(p.y-drag.dy,24,H-24);draw()});
  canvas.addEventListener('pointerup',()=>{if(drag&&selected>=0){const before=drag.before,after=elements[selected];if(before.x!==after.x||before.y!==after.y){history.push({theme,elements:elements.map((e,i)=>i===selected?{...before}:{...e})});if(history.length>30)history.shift()}}drag=null});
  $('#photoInput').addEventListener('change',ev=>{const file=ev.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{photo=img;selected=-1;draw()};img.src=reader.result};reader.readAsDataURL(file)});
  $$('#themeGrid [data-theme]').forEach(b=>b.addEventListener('click',()=>{if(theme===b.dataset.theme)return;saveHistory();theme=b.dataset.theme;$$('[data-theme]').forEach(x=>x.classList.toggle('active',x===b));draw()}));
  $$('#stickerGrid [data-sticker]').forEach(b=>b.addEventListener('click',()=>addSticker(b.dataset.sticker)));
  $('#addText').addEventListener('click',()=>addText($('#textInput').value));$('#textInput').addEventListener('keydown',e=>{if(e.key==='Enter')addText(e.currentTarget.value)});
  $$('.quick-copy [data-copy]').forEach(b=>b.addEventListener('click',()=>addText(b.dataset.copy)));
  function editSelected(fn){if(selected<0)return;saveHistory();fn(elements[selected]);draw()}
  $('#smaller').onclick=()=>editSelected(e=>e.size=clamp(e.size*.88,18,180));$('#bigger').onclick=()=>editSelected(e=>e.size=clamp(e.size*1.12,18,180));$('#rotateLeft').onclick=()=>editSelected(e=>e.rotation-=Math.PI/18);$('#rotateRight').onclick=()=>editSelected(e=>e.rotation+=Math.PI/18);$('#deleteElement').onclick=()=>{if(selected<0)return;saveHistory();elements.splice(selected,1);selected=-1;draw()};
  $('#undoBtn').onclick=()=>restore(history.pop());
  $('#resetBtn').onclick=()=>{if(!photo&&!elements.length&&theme==='lavender')return;saveHistory();photo=null;elements=[];selected=-1;theme='lavender';$$('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme==='lavender'));$('#photoInput').value='';draw()};
  $('#downloadBtn').onclick=()=>{const old=selected;selected=-1;draw();canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=`nugu-radar-topkku-${Date.now()}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);selected=old;draw()},'image/png',1)};
  $('#versionLabel').textContent=(window.NUGU_CONFIG||{}).build||'Updated 2026.09.09';draw();
})();

(()=>{
  document.body.classList.add('signal-lab-page');
  const cfg=window.NUGU_CONFIG||{},api=String(cfg.apiBase||'').replace(/\/$/,'');
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const deltaText=r=>{const n=Number(r?.delta||0);return `${n>0?'+':''}${(n*100).toFixed(2)}%`};
  async function data(){if(!api)return null;try{const r=await fetch(api+'/api/v1/home',{headers:{Accept:'application/json'},cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
  function enhanceIndex(payload){
    const map=new Map((payload?.artists||[]).map(a=>[String(a.slug||''),a]));
    document.querySelectorAll('[data-artist-slug]').forEach(li=>{
      const a=map.get(li.dataset.artistSlug),link=li.querySelector('a');if(!a||!link||link.querySelector('.lab-live-stats'))return;
      const coverage=Math.round(clamp(Number(a.coverage??a.radar?.coverage??0)*100));
      const score=clamp(a.score??a.radar?.score??0),rank=a.rank??a.radar?.rank??'—';
      const reason=(a.reasons||a.radar?.reasons||[])[0];
      link.insertAdjacentHTML('beforeend',`<div class="lab-live-stats"><span><b>#${esc(rank)}</b><em>RADAR</em></span><span><b>${esc(Number(score).toFixed(1).replace(/\.0$/,''))}</b><em>MOMENTUM</em></span><span><b>${coverage}%</b><em>COVERAGE</em></span></div><div class="lab-card-bars"><i style="--w:${score}%"></i><i style="--w:${coverage}%"></i></div><div class="lab-card-signal"><span>${reason?esc((reason.platform||'signal')+' · '+(reason.metric||'metric')):'SIGNAL BUILDING'}</span><b>${reason?esc(deltaText(reason)):'—'}</b></div>`);
    });
  }
  function enhanceDetail(){
    const box=document.querySelector('.artist-radar');if(!box||box.dataset.labEnhanced)return;
    const txt=box.textContent||'',m=txt.match(/Momentum rank:\s*#([^·\n]+).*?Score:\s*([^·\n]+).*?Coverage:\s*(\d+)%/s);
    if(!m)return;box.dataset.labEnhanced='1';
    const rank=m[1].trim(),score=clamp(parseFloat(m[2])),coverage=clamp(parseFloat(m[3]));
    const lis=[...box.querySelectorAll('li')],reasons=lis.map(li=>{const t=li.textContent||'',d=t.match(/([-+]?\d+(?:\.\d+)?)%/);return {text:t.replace(/\s+/g,' ').trim(),delta:d?Math.abs(parseFloat(d[1])):0}}).filter(x=>x.delta||x.text);
    const max=Math.max(0,...reasons.map(x=>x.delta));
    const bars=reasons.slice(0,8).map(x=>`<div class="signal-reason"><div class="signal-reason-head"><b>${esc(x.text.replace(/·\s*[-+]?\d+(?:\.\d+)?%.*$/,''))}</b><span>${esc((x.text.match(/[-+]?\d+(?:\.\d+)?%/)||['—'])[0])}</span></div><div class="signal-reason-track"><i style="--w:${max?Math.max(4,x.delta/max*100):4}%"></i></div></div>`).join('');
    box.insertAdjacentHTML('afterbegin',`<div class="signal-dashboard"><div class="signal-dashboard-head"><b>IDOL SIGNAL LAB · LIVE SNAPSHOT</b><span>FOR MY IDOL</span></div><div class="signal-kpis"><article><small>RADAR RANK</small><strong>#${esc(rank)}</strong><span>recent movement</span></article><article><small>MOMENTUM</small><strong>${esc(score)}</strong><span>change score</span></article><article><small>SIGNAL COVERAGE</small><div class="signal-ring" style="--coverage:${coverage}"><b>${coverage}%</b></div><span>observed signals</span></article></div>${bars?`<div class="signal-reasons">${bars}</div>`:''}</div>`);
  }
  enhanceDetail();data().then(enhanceIndex);
})();
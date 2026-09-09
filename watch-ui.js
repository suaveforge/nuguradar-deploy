(()=>{
  const player=document.getElementById('watchPlayer');
  const playerBody=document.getElementById('playerBody');
  let portraitNext=false;
  const ytId=url=>{const s=String(url||'');let m=s.match(/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([^/]+)\//i);if(m)return m[1];m=s.match(/[?&]v=([^&#]+)/i);if(m)return m[1];m=s.match(/youtu\.be\/([^?&#/]+)/i);return m?m[1]:''};
  function qualityCandidates(img){const original=img.dataset.direct||img.getAttribute('src')||'';const id=ytId(original)||ytId(img.getAttribute('src'));const rows=[];const push=u=>{if(u&&!rows.includes(u))rows.push(u)};if(id){push(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`);push(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/sddefault.jpg`);push(`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`)}push(original);push(img.dataset.fallback);return rows}
  function upgradeThumb(img){if(!img||img.dataset.qualityWired)return;img.dataset.qualityWired='1';const candidates=qualityCandidates(img);if(!candidates.length)return;let idx=0;const apply=()=>{if(idx>=candidates.length){img.dataset.quality='fallback';return}img.src=candidates[idx];img.dataset.quality=idx===0?'max':idx===1?'sd':idx===2?'hq':'fallback'};img.addEventListener('error',()=>{idx++;apply()});img.addEventListener('load',()=>{if(img.naturalWidth&&img.naturalWidth<480&&idx<candidates.length-1){idx++;apply()}});apply()}
  function scanThumbs(root=document){root.querySelectorAll?.('.watch-thumb img').forEach(upgradeThumb)}
  function cardLooksPortrait(card){if(!card)return false;const kind=(card.querySelector('.watch-artist small')?.textContent||'').toLowerCase();const title=(card.querySelector('.watch-copy h2')?.textContent||'').toLowerCase();return kind.includes('shorts')||title.includes('#shorts')||title.includes(' shorts')}
  document.addEventListener('pointerdown',e=>{const card=e.target.closest?.('.watch-card');if(card)portraitNext=cardLooksPortrait(card)},true);
  document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const card=e.target.closest?.('.watch-card');if(card)portraitNext=cardLooksPortrait(card)},true);
  function syncPlayer(){if(!player)return;const title=(playerBody?.querySelector('.player-title h2')?.textContent||'').toLowerCase();const portrait=portraitNext||title.includes('#shorts')||title.includes(' shorts');player.classList.toggle('is-vertical',portrait);if(!player.open)portraitNext=false}
  const observer=new MutationObserver(mutations=>{for(const m of mutations){m.addedNodes.forEach(n=>{if(n.nodeType===1)scanThumbs(n)})}scanThumbs();syncPlayer()});
  observer.observe(document.body,{childList:true,subtree:true});
  player?.addEventListener('close',()=>{player.classList.remove('is-vertical');portraitNext=false});
  scanThumbs();
})();

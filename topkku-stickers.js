(()=>{
  const items=[
    {id:'heart-outline',label:'하트 라인',pack:'기본',access:'free',kind:'emoji',value:'♡'},
    {id:'heart-solid',label:'하트',pack:'기본',access:'free',kind:'emoji',value:'♥'},
    {id:'star',label:'별',pack:'기본',access:'free',kind:'emoji',value:'★'},
    {id:'sparkle',label:'반짝',pack:'기본',access:'free',kind:'emoji',value:'✦'},
    {id:'ribbon',label:'리본',pack:'기본',access:'free',kind:'emoji',value:'🎀'},
    {id:'flower',label:'꽃',pack:'기본',access:'free',kind:'emoji',value:'🌷'},
    {id:'bubble',label:'버블',pack:'기본',access:'free',kind:'emoji',value:'🫧'},
    {id:'clover',label:'클로버',pack:'기본',access:'free',kind:'emoji',value:'🍀'},
    {id:'bunny',label:'토끼',pack:'기본',access:'free',kind:'emoji',value:'🐰'},
    {id:'bear',label:'곰',pack:'기본',access:'free',kind:'emoji',value:'🐻'},
    {id:'cloud',label:'구름',pack:'기본',access:'free',kind:'emoji',value:'☁️'},
    {id:'radar',label:'레이더',pack:'기본',access:'free',kind:'emoji',value:'📡'},
    {id:'tape-pink',label:'핑크 테이프',pack:'다꾸',access:'free',kind:'tape',variant:'pink'},
    {id:'tape-lilac',label:'라일락 테이프',pack:'다꾸',access:'free',kind:'tape',variant:'lilac'},
    {id:'note-paper',label:'메모 조각',pack:'다꾸',access:'free',kind:'paper',variant:'note'},
    {id:'ticket-mini',label:'티켓 조각',pack:'다꾸',access:'free',kind:'paper',variant:'ticket'},
    {id:'pearl-dot',label:'미니 진주',pack:'포카',access:'free',kind:'pearl',variant:'single'},
    {id:'mini-gem',label:'미니 큐빅',pack:'포카',access:'free',kind:'gem',variant:'mini'},

    {id:'chrome-heart',label:'크롬 하트',pack:'찐 탑꾸',access:'activity',minPoints:30,kind:'chrome',variant:'heart'},
    {id:'pearl-chain',label:'진주 체인',pack:'찐 탑꾸',access:'activity',minPoints:30,kind:'pearl',variant:'chain',maxPerCanvas:4},
    {id:'jelly-heart',label:'젤리 하트',pack:'찐 탑꾸',access:'activity',minPoints:30,kind:'jelly',variant:'heart'},
    {id:'lace-corner',label:'레이스 코너',pack:'찐 탑꾸',access:'activity',minPoints:100,kind:'lace',variant:'corner',maxPerCanvas:4},
    {id:'acrylic-charm',label:'아크릴 참',pack:'찐 탑꾸',access:'activity',minPoints:100,kind:'acrylic',variant:'charm'},
    {id:'silver-star',label:'실버 스타',pack:'찐 탑꾸',access:'activity',minPoints:100,kind:'chrome',variant:'star'},
    {id:'holo-tape',label:'홀로 테이프',pack:'찐 탑꾸',access:'activity',minPoints:220,kind:'tape',variant:'holo',motion:'shimmer',maxPerCanvas:3},

    {id:'gem-shimmer',label:'샤이닝 젬',pack:'희귀',access:'points',unlockCost:60,kind:'gem',variant:'shimmer',motion:'shimmer',maxPerCanvas:2},
    {id:'holo-frame',label:'홀로그램 프레임',pack:'희귀',access:'points',unlockCost:90,kind:'frame',variant:'holo',motion:'specular',maxPerCanvas:1},
    {id:'aurora-sparkle',label:'오로라 스파클',pack:'희귀',access:'points',unlockCost:120,kind:'sparkle',variant:'aurora',motion:'sparkle',maxPerCanvas:3}
  ];
  window.NUGU_TOPKKU_STICKERS={items,byId:new Map(items.map(x=>[x.id,x])),limits:{totalObjects:90,motionObjects:6,privateSavesPerDay:30,publicPostsPerDay:10}};
})();

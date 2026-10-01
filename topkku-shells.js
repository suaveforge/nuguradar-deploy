(()=>{
  const shells={
    loaders:[
      {id:'clear',label:'투명 탑로더',tone:'clear'},
      {id:'frost',label:'프로스트 탑로더',tone:'frost'},
      {id:'pink',label:'핑크 탑로더',tone:'pink'},
      {id:'blue',label:'블루 탑로더',tone:'blue'},
      {id:'black',label:'블랙 탑로더',tone:'black'}
    ],
    frames:[
      {id:'none',label:'기본 프레임',style:'none'},
      {id:'white',label:'화이트 프레임',style:'solid',color:'#fffdf8'},
      {id:'black',label:'블랙 프레임',style:'solid',color:'#14151b'},
      {id:'pink',label:'핑크 프레임',style:'solid',color:'#f7b8ce'},
      {id:'blue',label:'블루 프레임',style:'solid',color:'#9cc5ef'},
      {id:'lace-white',label:'화이트 레이스',style:'lace',color:'#fffdf8'},
      {id:'couture-pink',label:'꾸뛰르 펄 핑크',style:'couture',color:'#f3a4c4',pearl:'#fffafc',metal:'#d8dbe5'},
      {id:'atelier-pink',label:'아틀리에 펄 핑크',style:'atelier',color:'#df8fb3',pearl:'#fffafc',metal:'#c8cbd6',base:'#fff9fc'},
      {id:'atelier-black',label:'미드나잇 실버',style:'atelier',color:'#20212a',pearl:'#f4f5f8',metal:'#aeb6c6',base:'#111219',dark:true},
      {id:'atelier-blue',label:'아틀리에 크리스탈 블루',style:'atelier',color:'#78b7e7',pearl:'#f3fbff',metal:'#9eb8d2',base:'#f4fbff'},
      {id:'lace-black',label:'블랙 레이스',style:'lace',color:'#17171c'}
    ],
    backings:[
      {id:'none',label:'백카드 없음',color:null},
      {id:'cream',label:'크림 백카드',color:'#f6ecda'},
      {id:'pink',label:'핑크 백카드',color:'#f8d9e6'},
      {id:'blue',label:'블루 백카드',color:'#dceafb'},
      {id:'black',label:'블랙 백카드',color:'#20222a'}
    ],
    packages:[
      {id:'none',label:'포장 없음',style:'none'},
      {id:'opp',label:'OPP 기본형',style:'opp'},
      {id:'opp-flap',label:'OPP 플랩형',style:'opp-flap'}
    ],
    seals:[
      {id:'none',label:'씰 없음',style:'none'},
      {id:'heart',label:'하트 씰',style:'heart',color:'#f29ab8'},
      {id:'star',label:'별 씰',style:'star',color:'#d8c4ff'},
      {id:'clear',label:'투명 원형 씰',style:'circle',color:'rgba(255,255,255,.58)'},
      {id:'for-you',label:'For you 씰',style:'label',text:'For you ♡'}
    ],
    defaults:{loaderId:'clear',frameId:'none',backingId:'none',packageId:'none',sealId:'none'}
  };
  for(const key of ['loaders','frames','backings','packages','seals'])shells[key+'ById']=new Map(shells[key].map(x=>[x.id,x]));
  window.NUGU_TOPKKU_SHELLS=shells;
})();
(async()=>{
  const title=document.getElementById('authCallbackTitle');const state=document.getElementById('authCallbackState');
  try{
    if(!window.NUGU_AUTH_UI)throw new Error('auth_runtime_unavailable');
    const destination=await window.NUGU_AUTH_UI.completeCallback();
    title.textContent='You’re in.';state.textContent='Your account is connected. Existing picks, Radar Time, Glow and comments stay with you.';
    setTimeout(()=>location.replace(destination),250);
  }catch(error){
    console.warn('AuthHub callback failed',error);
    title.textContent=error?.message==='pending_approval'?'Approval pending.':'Sign in did not finish.';
    state.textContent=error?.message==='pending_approval'?'This account is waiting for AuthHub approval.':'The AuthHub handoff could not be completed. Return and try signing in again.';
  }
})();

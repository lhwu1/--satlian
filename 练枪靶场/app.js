(() => {
  const $ = id => document.getElementById(id);
  const stage = document.querySelector('.stage'), targets = $('targets');
  let active = false, started = 0, hit = 0, shots = 0, batch = 1, last = 0, totalDistance = 0, lastMouse = null, samples = [], timer, roundTimer, panelVisible = false, range = null;
  let paused = false, pauseStarted = 0, countdownEnd = 0, roundEnd = 0;
  const speed = { slow: .45, normal: .8, fast: 1.25 };
  const world = document.querySelector('#world');
  let dpiMultiplier=1;
  let placedInWarehouse = false;
  function confinePlayer() { try { const g=world.contentWindow.__G, p=g&&g.player; if(!world.contentWindow.__ready||!p||!p.pos)return; if(!placedInWarehouse){const spawn={pos:new g.THREE.Vector3(-12.8,2.6,-23.15),yaw:-2.15};
      g.level.playerStart=spawn;
      p.reset(spawn); p.pitch=-.12; p.invulnerable=true;
      g.physics.bounds={min:new g.THREE.Vector3(-16,0,-28),max:new g.THREE.Vector3(12,10,-11)};
      placedInWarehouse=true;} p.pos.x=Math.max(-15.5,Math.min(11.5,p.pos.x)); p.pos.z=Math.max(-27.5,Math.min(-11.5,p.pos.z)); if(p.pos.y<0)p.pos.y=0; if(g.weapon&&$("infinite").checked){g.weapon.ammo=g.weapon.magSize;g.weapon.reserve=999999;} if(!p.trainingRecoil){p.trainingRecoil=p.addRecoil.bind(p);p.addRecoil=(...args)=>{if($("recoil").checked)p.trainingRecoil(...args);};} if(g.hud&&g.hud.root)g.hud.root.style.display='none'; } catch(e) {} }
  setInterval(confinePlayer,50);
  $('count').oninput = e => $('countOut').textContent = e.target.value;
  $('sens').oninput = e => { const value=+e.target.value;$('sensOut').textContent = value.toFixed(2);$('sensNumber').value=value.toFixed(2);$('sens').style.setProperty('--range-fill',((value-.25)/2.25*100)+'%');applySensitivity(value); };
  $('sensNumber').oninput=e=>{const text=e.target.value,value=+text;if(!Number.isFinite(value)||value<.25||value>2.5)return;$('sens').value=value;$('sens').dispatchEvent(new Event('input'));e.target.value=text;};
  $('sensNumber').onchange=()=>{$('sensNumber').value=(+$('sens').value).toFixed(2);};
  $('sens').dispatchEvent(new Event('input'));
  function applySensitivity(value) { try { const g=world.contentWindow.__G; if(g&&g.input) g.input.sensitivity=value*dpiMultiplier; } catch(e) {} }
  document.addEventListener('range-dpi-change',e=>{dpiMultiplier=e.detail.ratio;applySensitivity(+$('sens').value);});
  function banner(s) { $('banner').textContent = s; }
  const HISTORY_KEY='range-training-history-v1';
  let history=[]; try{history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{}
  function renderHistory(){const list=$('historyList');if(!list)return;list.replaceChildren();$('historyCount').textContent=history.length;$('historyEmpty').hidden=history.length>0;history.slice().reverse().forEach(r=>{const li=document.createElement('li'),b=document.createElement('button'),main=document.createElement('span'),detail=document.createElement('small');main.textContent=new Date(r.time).toLocaleString()+' · '+(r.source==='ai'?'AI 调整':'手动设置')+' · 窗口 DPI '+(r.pageDpi||'—')+' · '+(r.mode==='moving'?'无人机移动靶':'随机固定靶');detail.textContent=`得分 ${Math.round((r.score||0)*1000)} / 1000 · 命中率 ${Math.round((r.score||0)*100)}% · 硬件基准 ${r.hardwareDpi||'未确认'} DPI`;b.append(main,detail);b.onclick=()=>{coach.dpi=+r.pageDpi||null;coach.hardwareDpi=+r.hardwareDpi||null;coach.source=r.dpiSource||'history';coach.saveDpi();$('moving').checked=r.mode==='moving';$('random').checked=r.mode!=='moving';$('random').disabled=r.mode==='moving';if(active)reset();else clearTargets();$('historyDialog').close();enterRange()};li.append(b);list.append(li)})}
  function saveHistory(source,report){history.push({time:Date.now(),source,pageDpi:coach.dpi,hardwareDpi:coach.hardwareDpi,dpiSource:coach.source,mode:$('moving').checked?'moving':'static',score:report?.accuracy||0});history=history.slice(-30);try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history))}catch{};renderHistory()}
  let roundLive=false, telemetry=[], directionChanges=0, mouseSamples=0, lastDirection=0, mouseBin=null, shotLog=[], roundConfig=null, starting=false;
  const coach=new TrainingCoach({game:()=>world.contentWindow?.__G,showSettings:showPanel,start:()=>start()});
  let entryHintTimer;
  function toggleHelp(){
    if(document.querySelector('.app').classList.contains('initial'))return;
    $('keyHelp').hidden=!$('keyHelp').hidden;
    $('helpToggle').setAttribute('aria-expanded',String(!$('keyHelp').hidden));
  }
  $('helpToggle').onclick=toggleHelp;
  function entryHint(){
    clearTimeout(entryHintTimer);$('entryHint').hidden=false;
    $('entryHint').getAnimations().forEach(animation=>animation.cancel());
    $('entryHint').animate([{opacity:0,offset:0},{opacity:1,offset:.1},{opacity:.35,offset:.22},{opacity:1,offset:.34},{opacity:.35,offset:.46},{opacity:1,offset:.58},{opacity:1,offset:.72},{opacity:0,offset:1}],{duration:3000});
    entryHintTimer=setTimeout(()=>$('entryHint').hidden=true,3000);
  }
  function clearTargets(){range?.clear();}
  function setup(show=false){
    clearTargets();
    if(show && range) {
      if($('moving').checked)range.movingBatch();
      else range.staticBatch();
    }
  }
  function shoot(){
    if(coach.calibration||!active||!roundLive||paused||!range?.items.length)return;
    shots++;
    const success=range.hit();
    shotLog.push({t:Math.round(performance.now()-started),hit:success});
    if(success){
      hit++;const now=performance.now();samples.push({reaction:now-last});last=now;
      if(!range.items.length)setTimeout(nextBatch,220);
    }
    update();
  }
  function update() { $('score').textContent=`第 ${batch} 批 · 命中 ${hit} / ${shots}`; $('accuracy').textContent=shots?Math.round(hit/shots*100)+'%':'—'; const rs=samples.map(x=>x.reaction); $('reaction').textContent=rs.length?Math.round(rs.reduce((a,b)=>a+b,0)/rs.length)+' ms':'—'; $('distance').textContent=Math.round(totalDistance)+' 输入单位'; }
  function nextBatch() { if(!active)return;if(paused){setTimeout(nextBatch,220);return;} setup(true); batch++; banner(`第 ${batch} 批靶子 · 全部命中后进入下一批`); update(); }
  async function start() {
    if(!range){banner('场景尚未准备完成，请等待加载或重新进入靶场');return;}
    if(starting||coach.calibrated||!coach.beforeStart())return;
    coach.cancelRequest();starting=true;$('start').disabled=true;
    try{if($('moving').checked)await range.prepareMovers();}
    catch(e){banner(e.message);return;}
    finally{starting=false;$('start').disabled=false;}
    active=true;roundLive=false;paused=false;panelVisible=false;
    $('keyHelp').hidden=true;$('helpToggle').setAttribute('aria-expanded','false');$('entryHint').hidden=true;
    coach.roundState(true);world.contentWindow.__G.player.enabled=true;
    document.querySelector('.panel').classList.remove('visible');
    batch=1;hit=shots=totalDistance=0;samples=[];telemetry=[];shotLog=[];directionChanges=mouseSamples=lastDirection=0;mouseBin=null;
    roundConfig={dpi:coach.hardwareDpi,pageDpi:coach.dpi,dpiSource:coach.source,sensitivity:+$('sens').value,effectiveSensitivity:+$('sens').value*dpiMultiplier,mode:$('moving').checked?'moving':'static',recoil:$('recoil').checked};
    update();setup(false);banner('准备开始…');
    try{world.contentWindow.focus();world.contentWindow.__G.input.requestLock();}catch(e){}
    clearInterval(timer);clearTimeout(roundTimer);countdownEnd=performance.now()+3000;
    timer=setInterval(()=>{
      if(paused)return;
      const left=Math.max(0,countdownEnd-performance.now());$('timer').textContent=(left/1000).toFixed(1)+' s';
      if(left)return;
      clearInterval(timer);
      try{setup(true);}catch(e){reset();banner(e.message);return;}
      banner($('moving').checked?'移动靶训练 · 无人机空中飞行，无人机逐架出现':'仓库训练区 · 10 个红靶全部命中后刷新');runRound();
    },50);
  }
  function runRound(){
    const limit=+$('round').value*1000;roundLive=true;started=last=performance.now();roundEnd=started+limit;
    timer=setInterval(()=>{if(paused)return;const remain=Math.max(0,roundEnd-performance.now());$('timer').textContent=(remain/1000).toFixed(1)+' s';if(!remain)finish();},100);
  }
  function finish(){
    if(!active)return;active=false;roundLive=false;clearInterval(timer);clearTimeout(roundTimer);
    if(mouseBin)telemetry.push(mouseBin);mouseBin=null;
    const intervals=samples.map(x=>Math.round(x.reaction)),duration=Math.max(.001,(performance.now()-started)/1000);
    const report={...roundConfig,hits:hit,shots,accuracy:hit/Math.max(1,shots),hitIntervals:intervals,averageHitInterval:intervals.length?intervals.reduce((a,b)=>a+b,0)/intervals.length:0,distance:Math.round(totalDistance),duration,mouseSamples,directionChanges,trajectory:telemetry,shotLog,rawInput:world.contentWindow.__G.input.rawMouse===true};
    banner('本轮完成 · 查看训练报告与优化建议');update();coach.showResult(report); saveHistory('user',report);
  }
  function reset(){active=false;roundLive=false;coach.reset();clearInterval(timer);clearTimeout(roundTimer);setup(false);showPanel();$('timer').textContent='00.0 s';banner('训练尚未开始');}
  function recordMouse(e){
    coach.capture(e);
    if(!active||!roundLive||paused||!world.contentWindow.__G?.input.locked)return;
    const dx=e.movementX||0,dy=e.movementY||0;if(!dx&&!dy)return;
    const now=Math.round(performance.now()-started),sign=Math.abs(dx)>=2?Math.sign(dx):0;
    totalDistance+=Math.hypot(dx,dy);mouseSamples++;
    if(sign&&lastDirection&&sign!==lastDirection)directionChanges++;if(sign)lastDirection=sign;
    if(!mouseBin||now-mouseBin.t>=50){if(mouseBin)telemetry.push(mouseBin);mouseBin={t:now,dx:0,dy:0,distance:0};}
    mouseBin.dx+=dx;mouseBin.dy+=dy;mouseBin.distance+=Math.hypot(dx,dy);
  }
  let animationTime=performance.now();
  function animateRange(now){
    const dt=Math.min(.05,(now-animationTime)/1000);animationTime=now;
    range?.step(dt,speed[$('speed').value],active&&roundLive&&!paused);
    requestAnimationFrame(animateRange);
  }
  requestAnimationFrame(animateRange);
  function toggleMovers(){
    $('random').checked=!$('moving').checked;
    $('random').disabled=$('moving').checked;
    if(active)reset();else clearTargets();
  }
  function showPanel(){panelVisible=true;document.querySelector('.panel').classList.add('visible');try{world.contentWindow.__G.input.exitLock();}catch(e){} banner('设置栏已显示 · 按 P 隐藏');}
  function openExit(){
    if(!placedInWarehouse||$('exitDialog').open||coach.blocking)return;
    paused=true;pauseStarted=performance.now();
    try{world.contentWindow.__G.input.exitLock();world.contentWindow.__G.player.enabled=false;}catch(e){}
    $('exitDialog').showModal();
  }
  function resumeRange(){
    const elapsed=performance.now()-pauseStarted;
    started+=elapsed;last+=elapsed;countdownEnd+=elapsed;roundEnd+=elapsed;
    paused=false;$('exitDialog').close();
    const g=world.contentWindow.__G;
    g.player.enabled=true;
    if(!panelVisible){world.contentWindow.focus();g.input.requestLock();}
  }
  $('exitDialog').addEventListener('cancel',e=>{e.preventDefault();resumeRange();});
  $('resumeRange').onclick=resumeRange;
    $('leaveRange').onclick=()=>{
    active=false;roundLive=false;paused=false;coach.reset();clearInterval(timer);clearTimeout(roundTimer);clearTargets();
    range=null;placedInWarehouse=false;panelVisible=false;readyFrame=null;
    clearTimeout(entryHintTimer);$('entryHint').hidden=true;$('keyHelp').hidden=true;$('helpToggle').setAttribute('aria-expanded','false');
    document.querySelector('.panel').classList.remove('visible');
    $('exitDialog').close();world.src='about:blank';
    document.querySelector('.app').classList.add('initial');stage.classList.remove('ready');
    $('timer').textContent='00.0 s';
  };
  function crosshairSettings(){
    const cross=document.querySelector('.crosshair');
    cross.dataset.style=$('crossStyle').value;
    cross.style.setProperty('--cross-size',$('crossSize').value+'px');
    cross.style.setProperty('--cross-color',$('crossColor').value);
    $('crossSizeOut').textContent=$('crossSize').value+' px';
    try{localStorage.setItem('range-crosshair',JSON.stringify({style:$('crossStyle').value,size:$('crossSize').value,color:$('crossColor').value}));}catch(e){}
  }
  try{const saved=JSON.parse(localStorage.getItem('range-crosshair'));if(saved){$('crossStyle').value=saved.style;$('crossSize').value=saved.size;$('crossColor').value=saved.color;}}catch(e){}
  for(const id of ['crossStyle','crossSize','crossColor'])$(id).oninput=crosshairSettings;
  crosshairSettings();
  function handleKeys(e){
    if(coach.handleKey(e)||coach.blocking)return;
    if(e.code==='Tab'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)toggleHelp();return;}
    if(e.code==='KeyP'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){
      e.preventDefault();e.stopImmediatePropagation();window.focus();
      if(panelVisible){panelVisible=false;document.querySelector('.panel').classList.remove('visible');banner('设置栏已隐藏 · 按 P 显示');}else showPanel();
    }
    if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();openExit();}
  }
  document.addEventListener('keydown',handleKeys);
  function bindFrameKeys(){try{
    const doc=world.contentDocument,css=doc.createElement('style');css.textContent='#boot,#ui,.hud,.menu,.comms,.loc-card{display:none!important}';doc.head.appendChild(css);
    let hadLock=false;
    doc.addEventListener('pointerlockchange',()=>{
      const locked=!!doc.pointerLockElement;
      if(hadLock&&!locked){
        if(coach.calibrated)coach.endCalibration('鼠标已释放，请重新校准或手填 DPI。');
        else if(!panelVisible&&!$('exitDialog').open&&!coach.blocking)openExit();
      }
      hadLock=locked;
    });
    world.contentWindow.addEventListener('mousedown',e=>{if(e.button===0&&world.contentWindow.__G?.input.locked)shoot();});
    world.contentWindow.addEventListener('mousemove',recordMouse);
    world.contentWindow.addEventListener('keydown',handleKeys,true);
  }catch(e){console.error('靶场输入绑定失败',e);}}
  const loader = new RangeLoader(world, $('loading'), stage);
  let readyFrame=null;
  function rangeReady(){
    const g=world.contentWindow.__G;
    if(!g?.player||!g?.game||readyFrame===world.contentWindow)return;
    readyFrame=world.contentWindow;
    range?.clear();range=new RangeTargets(g,targets);
    g.render.setQuality({...g.quality,scale:1,motionBlur:false});
    if(g.render.tune){g.render.tune.ca=0;g.render.tune.grain=0;}
    g.render.resize();
    confinePlayer();applySensitivity(+$('sens').value);banner('');entryHint();}
  world.addEventListener('range-ready', rangeReady);
  async function enterRange(){
    if(loader.running)return;
    range?.clear();range=null;placedInWarehouse=false;
    document.querySelector('.app').classList.remove('initial');
    if(await loader.load('yard', bindFrameKeys))rangeReady();
  }
  $('historyToggle').onclick=()=>$('historyDialog').showModal(); $('closeHistory').onclick=()=>$('historyDialog').close(); $('clearHistory').onclick=()=>{history=[];renderHistory();try{localStorage.removeItem(HISTORY_KEY)}catch{}}; $('historyDialog').addEventListener('click',e=>{if(e.target===$('historyDialog'))$('historyDialog').close()});
  document.addEventListener('range-ai-adjusted',()=>saveHistory('ai')); renderHistory(); $('resetDpi').onclick=()=>{coach.resetDpi();reset()};
  $('start').onclick=start; $('enter').onclick=enterRange; $('reset').onclick=reset; $('moving').onchange=toggleMovers; $('random').onchange=()=>{$('random').checked=true;};
})();















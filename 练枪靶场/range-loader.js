class RangeLoader {
  constructor(frame, overlay, stage) {
    this.frame=frame; this.overlay=overlay; this.stage=stage; this.running=false;
    this.retry=document.createElement('button'); this.retry.className='primary';
    this.retry.textContent='重新加载'; this.retry.hidden=true; overlay.appendChild(this.retry);
  }
  async load(map,onDocument) {
    if(this.running)return false;
    this.running=true; this.onDocument=onDocument; this.map=map;
    this.overlay.style.display='flex'; this.overlay.classList.remove('failed');
    this.retry.hidden=true; this.stage.classList.add('ready');
    const title=this.overlay.querySelector('b'),detail=this.overlay.querySelector('small');
    title.textContent='正在加载训练场景';detail.textContent='启动场景并等待首帧…';
    let poll,timeout,diagnostic;
    this.cleanupLoad?.();this.cleanupLoad=null;
    try {
      if(location.protocol==='file:')throw new Error('请双击“沿线练枪靶场.exe”启动，直接打开 HTML 无法访问本地训练资源。');
      await new Promise((resolve,reject)=>{
        let settled=false,bound=false,started=performance.now();
        const finish=e=>{if(settled)return;settled=true;clearInterval(poll);clearTimeout(timeout);clearTimeout(diagnostic);e?reject(e):resolve()};
        const failIfFatal=()=>{const w=this.frame.contentWindow;if(w?.__fatal)throw new Error(String(w.__fatal));};
        const bind=()=>{if(bound)return;this.onDocument?.();bound=true;const canvas=this.frame.contentDocument?.getElementById('view');canvas?.addEventListener('webglcontextlost',e=>{e.preventDefault();finish(new Error('显卡渲染上下文丢失，请重新加载场景。'))},{once:true})};
        const onLoad=()=>{try{const doc=this.frame.contentDocument;if(doc?.getElementById('view')){this.frameLoaded=true;this.loadedDocument=doc;detail.textContent='仓库场景文件已载入，正在创建 WebGL 场景…'}if(this.frame.contentWindow?.__fatal)finish(new Error(String(this.frame.contentWindow.__fatal)))}catch(e){finish(e)}};
        this.frame.addEventListener('load',onLoad);
        this.cleanupLoad=()=>this.frame.removeEventListener('load',onLoad);
        poll=setInterval(()=>{try{
          const w=this.frame.contentWindow;failIfFatal();
          if(w?.__ready&&w.__G?.player&&w.__G?.game){bind();finish();return}
          const sec=Math.floor((performance.now()-started)/1000),msg=w?.document?.getElementById('boot-msg')?.textContent||'正在初始化场景',pct=w?.document?.getElementById('boot-fill')?.style.width;
          if(pct)this.overlay.style.setProperty('--progress',pct);
          detail.textContent=`${msg} · ${sec} 秒${this.frameLoaded?' · 已载入，等待首帧':''}`;
        }catch(e){finish(e)}},150);
        timeout=setTimeout(()=>{let reason='场景启动等待超过 45 秒。';try{const w=this.frame.contentWindow;reason+=w?.__errors?.length?` 最近错误：${w.__errors.slice(-3).join('；')}`:' 请检查浏览器是否启用 WebGL，或稍后重试。'}catch{}finish(new Error(reason))},45000);
        diagnostic=setTimeout(()=>{if(settled)return;try{const w=this.frame.contentWindow;if(w?.__fatal)return finish(new Error(String(w.__fatal)));const errors=w?.__errors||[];if(errors.length)detail.textContent=`正在启动场景 · ${errors.slice(-1)[0]}`;}catch{}},8000);
        // Let the source page choose quality from the actual GPU; forcing "high" disables its software-GPU fallback.
        const query=new URLSearchParams({autostart:'1',noaudio:'1',training:map,tex:'1024',dynres:'0',v:'20261112-loader-fix3'});
        this.frame.src=`saltline-original.html?${query}`;
      });
      this.cleanupLoad?.();this.cleanupLoad=null;this.overlay.style.display='none';this.stage.classList.remove('boot');return true;
    }catch(error){
      this.cleanupLoad?.();this.cleanupLoad=null;
      this.frame.src='about:blank';
      console.error('Range loading failed:',error);this.overlay.classList.add('failed');this.overlay.style.display='flex';
      title.textContent='场景加载失败';detail.textContent=error.message||String(error);this.retry.hidden=false;
      this.retry.onclick=()=>this.load(this.map,this.onDocument).then(ok=>{if(ok)this.frame.dispatchEvent(new CustomEvent('range-ready'))});return false;
    }finally{clearInterval(poll);clearTimeout(timeout);clearTimeout(diagnostic);this.running=false}
  }
}

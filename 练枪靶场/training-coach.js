class TrainingCoach {
  constructor({game,showSettings,start}){
    this.$=id=>document.getElementById(id);this.game=game;this.showSettings=showSettings;this.start=start;
    this.dpi=null;this.hardwareDpi=null;this.source=null;this.calibration=null;this.pendingStart=false;this.result=null;this.request=null;this.raw=null;this.rawTimer=null;
    try{const x=JSON.parse(localStorage.getItem('range-dpi'));if(x?.dpi){this.dpi=+x.dpi;this.hardwareDpi=+(x.hardwareDpi||x.dpi);this.source=x.source||'manual'}}catch{}
    this.renderDpi();
    this.$('dpi').oninput=()=>{const v=+this.$('dpi').value;this.dpi=this.validDpi(v)?v:null;if(!this.hardwareDpi&&this.dpi)this.hardwareDpi=this.dpi;this.renderDpi();this.persistDpi()};
    this.$('dpiRange').oninput=()=>{this.dpi=+this.$('dpiRange').value;if(!this.hardwareDpi)this.hardwareDpi=this.dpi;this.saveDpi()};
    this.$('calibrate').onclick=()=>this.openCalibration(false);
    this.$('confirmManualDpi').onclick=()=>{const v=+this.$('manualDpi').value;if(!this.validDpi(v))return this.status('请输入 100 到 32000 之间的有效 DPI。');this.dpi=this.hardwareDpi=v;this.source='manual';this.saveDpi();this.completeCalibration()};
    this.$('cancelCalibration').onclick=()=>{this.cancelCalibration();this.$('calibrationDialog').close();this.showSettings()};
    this.$('readMouseSettings').onclick=()=>this.$('mousePermissionDialog').showModal();
    this.$('allowMouseRead').onclick=()=>this.readMouseSettings();this.$('denyMouseRead').onclick=()=>this.$('mousePermissionDialog').close();
    this.$('beginCalibration').onclick=()=>this.requestRawCalibration();
    this.$('calibrationDialog').addEventListener('cancel',e=>{e.preventDefault();this.cancelCalibration();this.$('calibrationDialog').close();this.showSettings()});
    this.$('calibrationDialog').addEventListener('cancel',e=>{e.preventDefault();this.cancelCalibration();this.$('calibrationDialog').close();this.showSettings()});
    this.$('allowRawCapture').onclick=()=>{this.$('rawPermissionDialog').close();this.beginRawCapture()};
    this.$('browserCalibration').onclick=()=>{this.$('rawPermissionDialog').close();this.beginBrowserCalibration()};
    this.$('denyRawCapture').onclick=()=>this.$('rawPermissionDialog').close();
    this.$('acceptCalibration').onclick=()=>this.finishBrowserCalibration();
    this.$('optimizeResult').onclick=()=>this.optimize();
    this.$('closeResult').onclick=()=>{this.$('resultDialog').close();this.showSettings()};
    this.$('retryWithoutAi').onclick=()=>{this.$('resultDialog').close();this.start()};
    this.$('retryOptimized').onclick=()=>{this.$('retryDialog').close();this.start()};
    this.$('inspectSettings').onclick=()=>{this.$('retryDialog').close();this.focusDpi()};
  }
  validDpi(v){return Number.isFinite(v)&&v>=100&&v<=32000}
  get blocking(){return !!this.request||!!this.calibration||['resultDialog','retryDialog','calibrationDialog','rawPermissionDialog','mousePermissionDialog'].some(x=>this.$(x)?.open)}
  get calibrated(){return !!this.calibration}
  status(t){this.$('calibrationStatus').textContent=t}
  renderDpi(){const d=this.dpi;this.$('dpiValue').textContent=d||'未确认';this.$('dpiRangeOut').textContent=d||'未确认';if(d)this.$('dpiRange').value=d;const ratio=d&&this.hardwareDpi?d/this.hardwareDpi:1;this.$('dpiSource').textContent=this.hardwareDpi?`基准 DPI ${this.hardwareDpi}；当前窗口倍率 ${ratio.toFixed(3)}×。`:'基准 DPI 未知，请先校准或手填。';document.dispatchEvent(new CustomEvent('range-dpi-change',{detail:{ratio}}))}
  persistDpi(){try{localStorage.setItem('range-dpi',JSON.stringify({dpi:this.dpi,hardwareDpi:this.hardwareDpi,source:this.source}))}catch{}}
  saveDpi(){this.$('dpi').value=this.dpi||'';this.$('dpiRange').value=this.dpi||800;this.renderDpi();this.persistDpi()}
  beforeStart(){if(!this.validDpi(this.dpi)){this.pendingStart=true;this.openCalibration(true);return false}return true}
  openCalibration(pending){this.pendingStart=pending;this.showSettings();this.$('manualDpi').value=this.hardwareDpi||'';this.$('calibrationDialog').showModal();this.status('可授权本机 Raw Input 横向计数校准，也可按屏幕引导移动并输入实际距离。')}
  completeCalibration(){this.$('calibrationDialog').close();const pending=this.pendingStart;this.pendingStart=false;if(pending)this.start();else this.focusDpi()}
  focusDpi(){this.showSettings();this.$('dpiCard').scrollIntoView({block:'center'})}
  roundState(r){for(const id of ['dpi','dpiRange','calibrate','sens','sensNumber','round'])if(this.$(id))this.$(id).disabled=r}
  reset(){this.cancelRequest();this.result=null;this.roundState(false)}
  resetDpi(){this.dpi=this.hardwareDpi=null;this.source=null;this.cancelCalibration();try{localStorage.removeItem('range-dpi')}catch{}this.$('dpi').value='';this.$('manualDpi').value='';this.renderDpi()}
  release(){try{this.game()?.input.exitLock()}catch{}}
  async post(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw new Error(d.error||'本机校准服务请求失败');return d}
  async readMouseSettings(){this.$('mousePermissionDialog').close();this.$('mouseSettingsStatus').textContent='正在读取…';try{const d=await this.post('/api/mouse-settings',{consent:true});this.$('mouseSettingsStatus').textContent=`Windows 指针速度 ${d.pointerSpeed??'未知'}；增强指针精确度：${d.acceleration?'开启':'关闭'}。这不是硬件 DPI。`}catch(e){this.$('mouseSettingsStatus').textContent=`读取失败：${e.message}`}}
  requestRawCalibration(){this.$('calibrationDialog').close();this.$('rawPermissionDialog').showModal()}
  async beginRawCapture(){try{this.raw=await this.post('/api/mouse-calibration/start',{consent:true});this.calibration={kind:'raw',startX:this.raw.x,startBack:this.raw.back,startY:this.raw.y};this.showGuide('按空格开始，然后将鼠标沿桌面水平从左向右移动。按 Enter 完成本次采集。');this.rawTimer=setInterval(()=>this.pollRaw(),300)}catch(e){this.status(`原始鼠标采集未启动：${e.message}`);this.$('calibrationDialog').showModal()}}
  async pollRaw(){if(!this.raw)return;try{const d=await this.post('/api/mouse-calibration/status',{token:this.raw.token});this.raw=d;if(this.calibration?.kind==='raw'){const x=Math.max(0,(d.x-this.calibration.startX)+(d.back-this.calibration.startBack));this.progress(x,d.y-this.calibration.startY)}}catch(e){this.status(`采集状态读取失败：${e.message}`);this.cancelCalibration()}}
  beginBrowserCalibration(){this.$('calibrationDialog').showModal();this.calibration={kind:'browser',started:false,x:0,y:0,last:0};this.$('acceptCalibration').hidden=false;this.showGuide('按空格开始，沿屏幕自适应引导条从左向右移动，按 Enter 完成。浏览器输入估算精度较低。')}
  showGuide(message){const guide=this.$('calibrationGuide');guide.hidden=false;this.$('calibrationProgress').textContent=message;this.$('calibrationCursor').style.setProperty('--travel','0%');this.release()}
  progress(x,y){const rail=this.$('calibrationGuide').querySelector('.calibration-rail');const pct=Math.max(0,Math.min(100,x/Math.max(1,rail.clientWidth)*100));this.$('calibrationCursor').style.setProperty('--travel',`${pct}%`);this.$('calibrationProgress').textContent=`水平计数 ${Math.round(x)} · 垂直偏移 ${Math.round(y)} · 到达引导条 ${Math.round(pct)}%`}
  startCalibration(){if(!this.calibration)return false;if(this.calibration.kind==='raw'){this.calibration.startX=this.raw?.x||0;this.calibration.startBack=this.raw?.back||0;this.calibration.startY=this.raw?.y||0;this.status('正在记录 Raw Input，水平从左向右移动。按 Enter 完成。');return true}this.calibration.started=true;this.calibration.x=0;this.calibration.y=0;this.calibration.last=performance.now();this.$('acceptCalibration').hidden=false;return true}
  capture(e){const c=this.calibration;if(!c?.started)return;if(c.kind==='browser'){c.x+=Math.max(0,e.movementX||0);c.y+=Math.abs(e.movementY||0);this.progress(c.x,c.y)}}
  handleKey(e){if(!this.calibration)return false;if(e.code==='Space'){e.preventDefault();if(!this.calibration.started)this.startCalibration();return true}if(e.code==='Enter'){e.preventDefault();this.finishCalibration();return true}if(e.code==='Escape'){e.preventDefault();this.cancelCalibration();this.$('calibrationDialog').close();return true}return true}
  async finishCalibration(){const c=this.calibration;if(!c)return;if(c.kind==='browser')return this.finishBrowserCalibration();try{const d=await this.post('/api/mouse-calibration/stop',{token:this.raw.token});clearInterval(this.rawTimer);this.raw=null;this.calibration=null;const counts=Math.max(0,(d.x-c.startX)+(d.back-c.startBack)),cm=+this.$('calibrationCm').value;if(!counts||!Number.isFinite(cm)||cm<2||cm>100)throw new Error('有效水平计数或实际距离无效，请重新校准。');this.dpi=this.hardwareDpi=Math.round(counts/(cm/2.54));if(!this.validDpi(this.dpi))throw new Error('估算 DPI 超出支持范围，请检查测量距离。');this.source='raw-input';this.saveDpi();this.$('calibrationGuide').hidden=true;this.status(`校准完成：${this.dpi} DPI（${counts} 个水平原始计数 / ${cm} cm）。`);this.completeCalibration()}catch(e){this.calibration=null;this.$('calibrationGuide').hidden=true;this.status(`校准未完成：${e.message}`);this.$('calibrationDialog').showModal()}}
  finishBrowserCalibration(){const c=this.calibration;if(!c||c.kind!=='browser')return;const cm=+this.$('calibrationCm').value;if(!c.x||!Number.isFinite(cm)||cm<2||cm>100){this.status('请先横向移动鼠标，并填写实际移动距离。');return}this.dpi=this.hardwareDpi=Math.round(c.x/(cm/2.54));if(!this.validDpi(this.dpi)){this.status('估算 DPI 超出支持范围，请重新校准。');return}this.source='browser-estimate';this.calibration=null;this.$('calibrationGuide').hidden=true;this.saveDpi();this.status(`浏览器输入估算完成：约 ${this.dpi} DPI。`);this.completeCalibration()}
  endCalibration(message){if(!this.calibration)return;this.cancelCalibration();this.$('calibrationDialog').showModal();this.status(message)}
  async cancelCalibration(){clearInterval(this.rawTimer);this.rawTimer=null;if(this.raw){try{await this.post('/api/mouse-calibration/stop',{token:this.raw.token})}catch{}this.raw=null}this.calibration=null;this.$('calibrationGuide').hidden=true}
  showResult(result){this.result=result;this.roundState(false);this.$('resultTitle').textContent=result.mode==='moving'?'无人机移动靶报告':'固定靶报告';this.$('resultStats').textContent=`命中 ${result.hits} / ${result.shots}，命中率 ${Math.round(result.accuracy*100)}%`;this.$('resultScore').textContent=Math.round(result.accuracy*1000);const advice=this.$('resultImprovements');advice.replaceChildren();for(const s of [result.accuracy<.35?'命中率偏低，可先降低窗口灵敏度并练习平滑跟枪。':'保持当前节奏，尝试缩短瞄准修正时间。',result.directionChanges>result.mouseSamples*.25?'轨迹反向修正较多，建议降低灵敏度。':'鼠标轨迹较平稳，可尝试小幅提高灵敏度。']){const li=document.createElement('li');li.textContent=s;advice.append(li)}this.$('resultAiStatus').textContent='AI 尚未运行。分析完成后会说明调整幅度和原因，并询问是否开始下一轮。';this.$('resultDialog').showModal()}
  async optimize(){if(!this.result||this.request)return;const c=new AbortController();this.request=c;const btn=this.$('optimizeResult');btn.disabled=true;this.$('resultAiStatus').textContent='AI 正在分析本轮命中率、反向修正与鼠标轨迹…';try{const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.result),signal:c.signal});const d=await r.json();if(!r.ok)throw new Error(d.error||'AI 服务请求失败');const old=this.dpi,next=Math.max(100,Math.min(32000,Math.round(old*(+d.multiplier||1))));this.dpi=next;this.source='ai';this.saveDpi();this.$('resultDialog').close();this.$('optimizationChange').textContent=`窗口 DPI：${old} → ${next}（${((next/old-1)*100).toFixed(1)}%）`;this.$('optimizationReason').textContent=`AI 调整依据：${d.reason||'综合本轮命中与鼠标轨迹，进行小幅灵敏度修正。'}`;this.$('optimizationDpi').textContent='该调整仅影响靶场窗口内的视角速度。';document.dispatchEvent(new CustomEvent('range-ai-adjusted'));this.$('retryDialog').showModal()}catch(e){this.$('resultAiStatus').textContent=`AI 分析失败：${e.message} 当前 DPI 保持不变，可以直接再来一局。`}finally{this.request=null;btn.disabled=false}}
  cancelRequest(){this.request?.abort();this.request=null}
}

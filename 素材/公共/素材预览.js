(() => {
  const meta = JSON.parse(document.getElementById('along-asset').textContent);
  document.title = meta.name + ' · 沿线素材';
  document.getElementById('asset-title').textContent = meta.name;
  const frame = document.getElementById('preview');
  const previewScript = document.currentScript.src;
  frame.src = new URL('原场景运行时.html?show=along&noaudio=1&tex=512', previewScript).href;
  const status = document.getElementById('status');
  const channel = 'along-preview';
  const factory = document.getElementById('along-factory').textContent;
  let sent = false;
  const send = () => frame.contentWindow.postMessage({channel,type:sent?'ping':'preview',id:meta.id,factory}, '*');
  const onMessage = event => {
    if (event.source !== frame.contentWindow || event.data?.channel !== 'along-runtime') return;
    const message = event.data;
    if (message.type === 'ready' && !sent) { sent=true; frame.contentWindow.postMessage({channel,type:'preview',id:meta.id,factory}, '*'); return; }
    if (message.type === 'preview-ready') {
      const size=message.size||[0,0,0];
      status.textContent=`尺寸约 ${size.map(v=>Number(v).toFixed(2)).join(' × ')} 米`;
      document.documentElement.dataset.assetState='ready';window.clearInterval(keepalive);window.removeEventListener('message',onMessage);
    } else if (message.type === 'error') {
      status.textContent='素材加载失败：'+message.message;
      document.documentElement.dataset.assetState='error';window.clearInterval(keepalive);window.removeEventListener('message',onMessage);
      console.error(message.message);
    }
  };
  window.addEventListener('message',onMessage);
  frame.addEventListener('load',()=>{status.textContent='正在加载本地三维运行时…';send();});
  const keepalive=window.setInterval(send,500);
  window.setTimeout(()=>{
    if(document.documentElement.dataset.assetState) return;
    status.textContent='加载超时。请稍后重试；浏览器可能已阻止本地 WebGL。';
    document.documentElement.dataset.assetState='error';window.clearInterval(keepalive);window.removeEventListener('message',onMessage);
  },60000);
})();

(() => {
  const meta = JSON.parse(document.getElementById('along-asset').textContent);
  document.title = meta.name + ' · 沿线素材';
  document.getElementById('asset-title').textContent = meta.name;
  const frame = document.getElementById('preview');
  const previewScript = document.currentScript.src;
  frame.src = new URL('原场景运行时.html?show=along&noaudio=1&tex=512', previewScript).href;
  const status = document.getElementById('status');
  let timer = setInterval(() => {
    try {
      const w = frame.contentWindow;
      if (w.__fatal) throw Error(w.__fatal);
      if (!w.__ready || !w.__alongOriginal) return;
      clearInterval(timer); timer=null;
      const factory = new Function('ctx', document.getElementById('along-factory').textContent);
      Promise.resolve(factory({THREE:w.__G.THREE, original:w.__alongOriginal})).then(object=>{
      if (!object?.isObject3D) throw Error('素材工厂没有返回 Object3D');
      w.__alongPreviewObject = object;
      w.__G.scene.add(object);
      if(object.userData.alongUpdate) w.__G.showcaseInfo.update=dt=>object.userData.alongUpdate(dt);
      const bounds=object.userData.alongPreviewBounds;
      const box = bounds ? new w.__G.THREE.Box3(new w.__G.THREE.Vector3(...bounds.min),new w.__G.THREE.Vector3(...bounds.max)) : new w.__G.THREE.Box3().setFromObject(object);
      if (box.isEmpty()) throw Error('素材没有可见几何');
      const size = box.getSize(new w.__G.THREE.Vector3());
      const center = box.getCenter(new w.__G.THREE.Vector3());
      const distance = Math.max(size.x, size.y, size.z, 1) * 1.6;
      w.__setShot({cam:[center.x+distance,center.y+distance*.65,center.z+distance,center.x,center.y,center.z].join(','),fov:45});
      status.textContent = `尺寸约 ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} 米`;
      document.documentElement.dataset.assetState='ready';
      }).catch(error=>{document.documentElement.dataset.assetState='error';status.textContent='素材加载失败：'+error.message;console.error(error);});
    } catch (error) { clearInterval(timer); timer=null; document.documentElement.dataset.assetState='error';status.textContent = '素材加载失败：' + error.message; console.error(error); }
  }, 100);
  setTimeout(() => { if (timer) { clearInterval(timer); timer=null; if (!frame.contentWindow.__ready) status.textContent='加载超时，请检查 WebGL 或改用本地服务打开。'; } }, 60000);
})();

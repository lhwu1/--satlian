// 从未修改的原始场景生成共享预览运行时；原始 index.html 不写入。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
let source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// 只替换副本：离线字体、分类源码均不回写原 HTML。
source = source.replace(/<link[^>]*https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g, '');
const modulesFile=path.join(__dirname,'源码分段.json');
if(fs.existsSync(modulesFile)) for(const part of JSON.parse(fs.readFileSync(modulesFile,'utf8'))) {
  const start=source.indexOf(part.start), end=source.indexOf(part.end,start+part.start.length);
  if(start<0||end<0) throw Error('分类源码锚点丢失：'+part.file);
  source=source.slice(0,start)+fs.readFileSync(path.resolve(__dirname,part.file),'utf8')+source.slice(end);
}
const needle = 'QC().catch(i=>bM(i&&i.stack||i));})();';
// The game's cinematic postprocessing assumes its original depth/sky setup.
// Editor/standalone observation use the same geometry and PBR materials directly.
source=source.replace('t.render.frame(p)', 'n==="along"?(t.renderer.setRenderTarget(null),t.renderer.render(t.scene,t.camera)):t.render.frame(p)');
if (source.split(needle).length !== 2) throw new Error('原场景入口发生变化，无法安全生成适配器');
source=source.replace('let h=Qi(new rn(80,80).rotateX(-Math.PI/2),t.mats.get("concrete"),{cast:!1});if(t.scene.add(h),t.level=', 'let h=Qi(new rn(80,80).rotateX(-Math.PI/2),t.mats.get("concrete"),{cast:!1});if(n!=="along"&&t.scene.add(h),t.level=');
source = source.replace('if(n){if(t.showcaseInfo.update)', 'for(const object of window.__alongEditorObjects?.values()||[])if(object.userData.alongUpdate)try{object.userData.alongUpdate(p)}catch(error){};if(n){if(t.showcaseInfo.update)');
const adapter = `
gM.along={showcase:async()=>({})};
window.__alongOriginal={
  catalog:{props:Object.keys(Xg),materials:Object.keys(l1),sounds:Object.keys(Go)},
  soundInfo:Object.fromEntries(Object.entries(Go).map(([id,s])=>[id,{variants:s.n,sr:s.sr,loop:!!s.loop,ir:!!s.ir}])),
  synthesize(name,variant=0) { if(!Go[name]) throw Error('未知音效：'+name); return r_(name,variant); },
  material(name) { if(!Object.hasOwn(l1,name)) throw Error('未知材质：'+name); return window.__G.mats.get(name); },
  prop(name, options={}) {
    if(!Object.hasOwn(Xg,name)) throw Error('未注册的真实道具：'+name);
    const object=window.__G.props.build(name, options);
    object.userData.alongColliders=(object.userData.colliders||[]).map(c=>({min:c.min.slice(),max:c.max.slice(),surface:c.surface}));
    return this.decorate(object);
  },
  assembly(kind='warehouse') {
    const g=window.__G, collisions=[];
    const context=ob({...g,physics:{addBox(min,max,options){
      const arr=v=>Array.isArray(v)?v.slice():[v.x,v.y,v.z];
      collisions.push({min:arr(min),max:arr(max),surface:options?.surface});
    }}});
    const build={warehouse:ab,quay:cb,yard:hR,boundary:fR}[kind];
    if(!build) throw Error('未知组合：'+kind);
    build(context);
    const group=new lt.Group();
    group.add(context.staticRoot,context.dynRoot);
    group.userData.alongColliders=collisions;
    group.userData.alongUpdate=dt=>context.updaters.forEach(fn=>fn(dt));
    return window.__alongOriginal.normalize(group);
  },
  warehouse(){return this.assembly('warehouse')},
  normalize(group){
    group.updateMatrixWorld(true);
    const b=new lt.Box3().setFromObject(group),c=b.getCenter(new lt.Vector3()),offset=new lt.Vector3(-c.x,-b.min.y,-c.z);
    group.position.add(offset);
    group.userData.alongColliders=(group.userData.alongColliders||[]).map(c=>({...c,min:c.min.map((v,i)=>v+offset.getComponent(i)),max:c.max.map((v,i)=>v+offset.getComponent(i))}));
    return this.decorate(group);
  },
  decorate(group){
    const slots=new Map();
    group.traverse(o=>{if(o.isMesh){const m=Array.isArray(o.material)?o.material[0]:o.material;const id=(m?.name||'default').replace(/[^a-z0-9_]/gi,'_').toLowerCase();o.userData.alongSlot=id;slots.set(id,{id,name:m?.name||'默认材质'});}});
    group.userData.alongSlots=[...slots.values()];return group;
  },
  backdrop(kind){
    if(!['crane','ship','boat','sky'].includes(kind))throw Error('未知背景：'+kind);
    const g=window.__G,collisions=[],scene=new lt.Group();
    const component=Eb({...g,scene,physics:{addBox(min,max,options){const arr=v=>Array.isArray(v)?v.slice():[v.x,v.y,v.z];const c={min:arr(min),max:arr(max),surface:options.surface};collisions.push(c);return c}}},{only:kind});
    const root=component.root;root.userData.alongColliders=collisions;root.userData.alongUpdate=component.update;
    return this.normalize(root);
  },
  async ground(){
    const g=window.__G,scene=new lt.Group(),render={...g.render,addPrePass(){}};
    const component=await O1({...g,scene,render});component.setReflections(false);
    const root=component.root;root.userData.alongColliders=[{min:[-44,-.2,-40],max:[30,0,40],surface:'concrete'}];
    root.userData.alongUpdate=component.update;return this.decorate(root);
  },
  async weapon(part='weapon'){
    const g=window.__G,camera=new lt.PerspectiveCamera();
    const weapon=await dm({...g,camera,events:Dy()});
    const root=weapon.root,children=root.children;
    // dm 中的三个 Group 顺序为弹匣、右手、左手；其余为枪身网格。
    const groups=children.filter(o=>o.isGroup);const right=groups[1],left=groups[2];
    if(!right||!left)throw Error('原枪手部结构发生变化');right.name='hand_r';left.name='hand_l';groups[0].name='magazine';
    if(part==='weapon'){right.visible=false;left.visible=false;}else if(part==='hands'){for(const o of children)o.visible=o===right||o===left;}
    root.traverse(o=>o.layers.set(0));root.removeFromParent();
    root.userData.alongColliders=[];
    root.userData.alongAnchors={muzzle:mi.muzzle.slice(),grip:mi.grip.slice(),sight:[0,mi.sightY,mi.lensF]};
    if(part==='hands')root.userData.alongPreviewBounds={min:[-.35,-.4,-.45],max:[.35,.25,.4]};
    root.userData.alongNativeController=weapon;
    return this.decorate(root);
  },
  async actor(kind){
    if(!['gull','hound'].includes(kind))throw Error('未知角色');
    const g=window.__G,scene=new lt.Group(),system=await Em({...g,scene,events:Dy()});
    const actor=system.spawn(kind,new lt.Vector3(0,kind==='gull'?1.6:0,0),{passive:true,hover:1.6,patrolRadius:2,patrolLine:[new lt.Vector3(-2,0,0),new lt.Vector3(2,0,0)]});
    const root=new lt.Group();root.add(actor.rig.group);
    root.userData.alongColliders=[{min:[-.7,0,-.9],max:[.7,kind==='gull'?2.2:1.1,.9],surface:'metal',purpose:'occupancy'}];
    root.userData.alongPreviewBounds=kind==='gull'?{min:[-1,1,-1],max:[1,2.2,1]}:{min:[-1.2,0,-1.3],max:[1.2,1.3,1.3]};
    root.userData.alongUpdate=system.update;root.userData.alongNativeController={system,actor};
    return this.decorate(root);
  },
  hudDemo(){const g=window.__G;g.hud=hM(g);g.hud.show(true);g.showcaseInfo.update=dt=>g.hud.update(dt);return {hud:g.hud,events:g.events,player:g.player,weapon:g.weapon};}
};
// Preview/editor bridge: keep all Three.js access inside the runtime frame. This
// also works when both pages are opened from file://, where direct DOM access is blocked.
window.__alongEditorObjects = new Map();
function alongSyncPhysics(){
  const g=window.__G,T=g.THREE;
  for(const box of [...g.physics.boxes])if(box.tag==='along-editor')g.physics.removeBox(box);
  for(const root of window.__alongEditorObjects.values()){
    root.updateMatrixWorld(true);
    for(const c of root.userData.alongColliders||[]){
      const box=new T.Box3(new T.Vector3(...c.min),new T.Vector3(...c.max)).applyMatrix4(root.matrixWorld);
      g.physics.addBox(box.min,box.max,{surface:c.surface||'concrete',tag:'along-editor',playerOnly:c.surface==='airwall'});
    }
  }
  g.physics.build();
}
let alongPhysicsTimer;
function alongQueuePhysics(){clearTimeout(alongPhysicsTimer);alongPhysicsTimer=setTimeout(alongSyncPhysics,80);}
function alongReply(type, detail={}) { parent.postMessage({channel:'along-runtime', type, ...detail}, '*'); }
async function alongHandleMessage(data) {
  if (!data || data.channel !== 'along-preview' && data.channel !== 'along-editor') return;
  if (!window.__ready || !window.__G || !window.__alongOriginal) return;
  if (data.type === 'ping') { alongReply('ready'); return; }
  try {
    const T=window.__G.THREE, scene=window.__G.scene;
    if (data.type === 'preview' || data.type === 'add' || data.type==='thumbnail') {
      const factory=new Function('ctx',data.factory);
      const object=await factory({THREE:T,original:window.__alongOriginal});
      if (!object?.isObject3D) throw Error('素材工厂没有返回 Object3D');
      if (data.type === 'preview' || data.type==='thumbnail') {
        if(!window.__alongPreviewLighting){
          window.__alongPreviewLighting=true;
          scene.add(new T.HemisphereLight(0xd8efff,0xaaa18b,3.2));
          window.__G.render.sun.color.setHex(0xfff4dd);window.__G.render.sun.intensity=3.8;window.__G.render.sun.position.set(-30,65,-25);
          window.__G.renderer.toneMapping=T.ACESFilmicToneMapping;window.__G.renderer.toneMappingExposure=1.15;
          if(window.__G.render.sky)window.__G.render.sky.visible=true;scene.background=new T.Color(0x253037);scene.fog=null;
        }
        if (window.__alongPreviewObject) scene.remove(window.__alongPreviewObject);
        window.__alongPreviewObject=object;
        if(object.userData.alongUpdate) window.__G.showcaseInfo.update=dt=>object.userData.alongUpdate(dt);
        const bounds=object.userData.alongPreviewBounds;
        const box=bounds?new T.Box3(new T.Vector3(...bounds.min),new T.Vector3(...bounds.max)):new T.Box3().setFromObject(object);
        if(box.isEmpty()) throw Error('素材没有可见几何');
        const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
        scene.add(object);
        const distance=Math.max(size.x,size.y,size.z,1)*1.6;
        window.__setShot({cam:[center.x+distance,center.y+distance*.65,center.z+distance,center.x,center.y,center.z].join(','),fov:45});
        if(data.type==='thumbnail'){scene.background=new T.Color(0x253037);scene.fog=null;if(window.__G.render.sky)window.__G.render.sky.visible=true;await new Promise(resolve=>setTimeout(resolve,350));window.__G.render.renderer.render(scene,window.__G.camera);alongReply('thumbnail-ready',{id:data.id,url:window.__G.render.renderer.domElement.toDataURL('image/png')});}
        alongReply('preview-ready',{id:data.id,size:[size.x,size.y,size.z]});
      } else {
        object.name=data.id||'asset';
        object.position.set(...(data.transform?.position||[0,0,0]));
        object.rotation.set(...(data.transform?.rotation||[0,0,0]));
        object.scale.set(...(data.transform?.scale||[1,1,1]));
        if(window.__alongEditorObjects.has(data.id))scene.remove(window.__alongEditorObjects.get(data.id));
        scene.add(object);window.__alongEditorObjects.set(data.id,object);alongQueuePhysics();
        if(data.materials)for(const [slot,material] of Object.entries(data.materials))object.traverse(o=>{if(o.isMesh&&(slot==='*'||o.userData.alongSlot===slot))o.material=window.__alongOriginal.material(material);});
        alongReply('added',{id:data.id,size:object.userData.alongColliders?.length||0});
      }
      return;
    }
    if (data.type === 'editor-init') {
      if(!window.__alongEditorReady){
        /* No implicit foundation: the editor begins with no geometry.
        const floor=new T.Mesh(new T.PlaneGeometry(80,80),window.__G.mats.get('concrete'));
        floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.name='editor-ground';scene.add(floor);
        const grid=new T.GridHelper(80,80,0x657579,0x354347);grid.position.y=-.025;scene.add(grid); */
        scene.background=new T.Color(0xa7d4ed);scene.fog=new T.FogExp2(0xa7d4ed,.0015);if(window.__G.render.sky)window.__G.render.sky.visible=true;
        window.__G.render.sun.intensity=3.8;window.__G.render.sun.color.setHex(0xfff4dd);window.__G.render.sun.position.set(-30,65,-25);
        const ambient=new T.HemisphereLight(0xd8efff,0xaaa18b,3.2);scene.add(ambient);
        const renderer=window.__G.renderer;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
        window.__G.render.post.wet=0;
        window.__alongEditorReady=true;
        window.__setShot({cam:'22,24,28,0,0,0',fov:48});
      }
      alongReply('editor-ready');return;
    }
    if(data.type==='select'){const object=window.__alongEditorObjects.get(data.id);if(!object)return;const slots=new Map();object.traverse(o=>{if(o.isMesh){if(!o.userData.alongSlot)o.userData.alongSlot=o.material?.name||'body';slots.set(o.userData.alongSlot,{id:o.userData.alongSlot,name:o.userData.alongSlot});}});alongReply('slots',{id:data.id,slots:object.userData.alongSlots||[...slots.values()]});return;}
    if(data.type==='material'){const object=window.__alongEditorObjects.get(data.id);if(!object)throw Error('先选中对象');const material=window.__alongOriginal.material(data.material);object.traverse(o=>{if(o.isMesh&&(data.slot==='*'||o.userData.alongSlot===data.slot))o.material=material;});return;}
    if(data.type==='transform'){

      const o=window.__alongEditorObjects.get(data.id);if(!o)throw Error('找不到地图对象');
      if(data.position)o.position.set(...data.position);if(data.rotation)o.rotation.set(...data.rotation);if(data.scale)o.scale.set(...data.scale);
      alongQueuePhysics();alongReply('transformed',{id:data.id});return;
    }
    if(data.type==='remove'){
      const o=window.__alongEditorObjects.get(data.id);if(o){scene.remove(o);window.__alongEditorObjects.delete(data.id);}
      alongQueuePhysics();alongReply('removed',{id:data.id});return;
    }
    if(data.type==='clear-objects'){
      for(const o of window.__alongEditorObjects.values())scene.remove(o);
      window.__alongEditorObjects.clear();alongQueuePhysics();alongReply('cleared');return;
    }
    if(data.type==='colliders'){
      for(const root of window.__alongEditorObjects.values()){
        if(!root.userData.alongColliderVisuals){
          root.userData.alongColliderVisuals=(root.userData.alongColliders||[]).map(c=>{
            const min=new T.Vector3(...c.min),max=new T.Vector3(...c.max),size=max.clone().sub(min),center=max.clone().add(min).multiplyScalar(.5);
            const mesh=new T.Mesh(new T.BoxGeometry(Math.max(.01,size.x),Math.max(.01,size.y),Math.max(.01,size.z)),new T.MeshBasicMaterial({color:0xffbd62,wireframe:true,depthTest:false}));mesh.position.copy(center);mesh.renderOrder=20;root.add(mesh);return mesh;
          });
        }
        for(const mesh of root.userData.alongColliderVisuals)mesh.visible=!!data.visible;
      }
      return;
    }
    if(data.type==='camera'){
      const [x,y,z]=data.position||[22,24,28], target=data.target||[0,0,0];
      window.__setShot({cam:[x,y,z,...target].join(','),fov:data.fov||48});alongReply('camera-set');return;
    }
    if(data.type==='pick'){
      const canvas=window.__G.render.renderer?.domElement,camera=window.__G.camera||window.__G.viewCamera;
      if(!canvas||!camera)return;
      const pointer=new T.Vector2(data.x*2-1,-data.y*2+1);
      const raycaster=new T.Raycaster();raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects([...window.__alongEditorObjects.values()],true);
      for(const hit of hits){let node=hit.object;while(node&&window.__alongEditorObjects.get(node.name)!==node)node=node.parent;if(node){alongReply('picked',{id:node.name});return;}}
      alongReply('picked',{id:null});return;
    }
    if(data.type==='airwall'){
      const root=new T.Group(),dims=data.size||[4,3,.2];
      const mesh=new T.Mesh(new T.BoxGeometry(...dims),new T.MeshBasicMaterial({color:0x28b8a4,transparent:true,opacity:.22,depthWrite:false}));root.add(mesh);
      mesh.visible=!window.__alongObserver;root.name=data.id;root.rotation.set(...(data.transform?.rotation||[0,0,0]));root.scale.set(...(data.transform?.scale||[1,1,1]));root.position.set(...(data.transform?.position||[0,dims[1]/2,0]));
      root.userData.alongColliders=[{min:dims.map(v=>-v/2),max:dims.map(v=>v/2),surface:'airwall'}];
      if(window.__alongEditorObjects.has(data.id))scene.remove(window.__alongEditorObjects.get(data.id));
      scene.add(root);window.__alongEditorObjects.set(data.id,root);alongQueuePhysics();alongReply('added',{id:data.id});return;
    }
  } catch(error) { alongReply('error',{id:data.id,message:error?.message||String(error)}); }
}
window.addEventListener('message',event=>alongHandleMessage(event.data));
window.addEventListener('load',()=>{const ping=()=>{if(window.__ready)alongReply('ready');};setInterval(ping,500);});
`;
fs.writeFileSync(path.join(__dirname, '原场景运行时.html'), source.replace(needle, adapter + needle));


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
if (source.split(needle).length !== 2) throw new Error('原场景入口发生变化，无法安全生成适配器');
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
`;
fs.writeFileSync(path.join(__dirname, '原场景运行时.html'), source.replace(needle, adapter + needle));

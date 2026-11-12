// 从未修改的原始场景生成共享预览运行时；原始 index.html 不写入。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const needle = 'QC().catch(i=>bM(i&&i.stack||i));})();';
if (source.split(needle).length !== 2) throw new Error('原场景入口发生变化，无法安全生成适配器');
const adapter = `
gM.along={showcase:async()=>({})};
window.__alongOriginal={
  prop(name, options={}) {
    const object=window.__G.props.build(name, options);
    object.userData.alongColliders=(object.userData.colliders||[]).map(c=>({min:c.min.slice(),max:c.max.slice(),surface:c.surface}));
    return object;
  },
  warehouse() {
    const g=window.__G, collisions=[];
    const context=ob({...g,physics:{addBox(min,max,options){
      const arr=v=>Array.isArray(v)?v.slice():[v.x,v.y,v.z];
      collisions.push({min:arr(min),max:arr(max),surface:options?.surface});
    }}});
    ab(context);
    const group=new lt.Group();
    group.add(context.staticRoot,context.dynRoot);
    group.position.set(2,-0.03,19.5);
    group.userData.alongColliders=collisions.map(c=>({min:[c.min[0]+2,c.min[1]-.03,c.min[2]+19.5],max:[c.max[0]+2,c.max[1]-.03,c.max[2]+19.5],surface:c.surface}));
    return group;
  }
};
`;
fs.writeFileSync(path.join(__dirname, '原场景运行时.html'), source.replace(needle, adapter + needle));

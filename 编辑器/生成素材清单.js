// Scan only self-contained asset HTML files that follow the documented factory contract.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const groups = [
  ['素材/原有场景/场景组合', 'assembly'],
  ['素材/原有场景/港口背景', 'assembly'],
  ['素材/原有场景/地面天气', 'assembly'],
  ['素材/原有场景/道具', 'prop'],
  ['素材/原有场景/材质', 'material'],
  ['素材/角色', 'actor'],
  ['素材/武器', 'weapon'],
  ['素材/AI生成', 'custom'],
];
const assets = [];
const names = {barrel:'油桶',container40:'40英尺集装箱',container20:'20英尺集装箱',crane:'港口吊机',ship:'货轮',sky:'晴天天空',paint_red:'红色涂层',paint_green:'绿色涂层',gunmetal:'枪械金属',wood_dark:'深色木材',steel_dark:'深色钢材',concrete:'混凝土地面',ai_thompson1928:'汤姆逊 M1928',training_dummy:'战术训练假人'};
for (const [directory, kind] of groups) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) continue;
  for (const filename of fs.readdirSync(absolute).filter(name => name.endsWith('.html')).sort()) {
    if (directory.includes('角色') && /^(hands|手部)(\.html)?$/i.test(filename)) continue;
    const file = path.join(absolute, filename);
    const html = fs.readFileSync(file, 'utf8');
    const metadata = html.match(/<script id="along-asset" type="application\/json">([\s\S]*?)<\/script>/);
    const factory = html.match(/<script id="along-factory" type="text\/plain">([\s\S]*?)<\/script>/);
    if (!metadata || !factory) continue;
    try {
      const base = JSON.parse(metadata[1]); const key = base.id?.split('.').pop() || base.id; const displayName=names[key]||names[base.id]||(kind==='material'?'材质素材':base.name); assets.push({...base,nameZh:displayName,name:displayName,internalName:base.name,factory:factory[1],path:path.relative(root,file).replaceAll('\\','/'),kind:(base.assetKind==='weapon'||base.kind==='weapon')?'weapon':kind,assetKind:base.assetKind||base.kind||kind,previewPath:fs.existsSync(path.join(root,'素材/预览',base.id+'.png'))?'素材/预览/'+base.id+'.png':undefined});
    } catch (error) {
      throw new Error(`素材元数据错误：${file}: ${error.message}`);
    }
  }
}
fs.writeFileSync(path.join(__dirname, 'assets.js'), `window.ALONG_ASSETS=${JSON.stringify(assets)};\n`, 'utf8');
console.log(`已生成 ${assets.length} 个可拖拽素材。`);






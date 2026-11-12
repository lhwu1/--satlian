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
      assets.push({ ...JSON.parse(metadata[1]), factory: factory[1], path: path.relative(root, file).replaceAll('\\', '/'), kind });
    } catch (error) {
      throw new Error(`素材元数据错误：${file}: ${error.message}`);
    }
  }
}
fs.writeFileSync(path.join(__dirname, 'assets.js'), `window.ALONG_ASSETS=${JSON.stringify(assets)};\n`, 'utf8');
console.log(`已生成 ${assets.length} 个可拖拽素材。`);

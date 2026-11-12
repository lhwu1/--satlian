// 为原始构建器生成独立素材入口。生成结果可单独拷贝或修改，公共运行时只保存一份。
const fs = require('fs');
const path = require('path');
const directory = path.resolve(__dirname, '../原有场景');
fs.mkdirSync(directory, {recursive:true});
const assets = [
  ['原有仓库', 'original.warehouse', '建筑', 'return ctx.original.warehouse();'],
  ['原有20尺集装箱', 'original.container20', '建筑', 'return ctx.original.prop("container20", {seed:7, color:"blue", doors:0});'],
  ['原有40尺集装箱', 'original.container40', '建筑', 'return ctx.original.prop("container40", {seed:7, color:"blue", doors:0});'],
  ['原有木箱', 'original.crate_wood', '道具', 'return ctx.original.prop("crate_wood", {seed:7});'],
  ['原有油桶', 'original.barrel', '道具', 'return ctx.original.prop("barrel", {seed:7, color:"blue"});'],
  ['原有标点装置', 'original.relay_node', '标点', 'return ctx.original.prop("relay_node", {seed:0, label:"A"});']
];
for (const [name,id,category,factory] of assets) {
  const meta = JSON.stringify({schema:'along.html-asset/1',id,name,version:'1.0.0',category,origin:'原始场景',units:'m'},null,2);
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title><style>html,body{margin:0;height:100%;background:#161c20;color:#fff;font:14px sans-serif}iframe{width:100%;height:100%;border:0}header{position:fixed;top:0;left:0;padding:12px 16px;background:#10181cbb;pointer-events:none}h1{font-size:18px;margin:0 0 5px}p{margin:0;color:#c8d2d2}</style></head>
<body><iframe id="preview" title="素材预览"></iframe><header><h1 id="asset-title"></h1><p id="status">正在加载原场景材质与模型…</p></header>
<script id="along-asset" type="application/json">${meta}</script>
<script id="along-factory" type="text/plain">${factory}</script>
<script src="../公共/素材预览.js"></script></body></html>\n`;
  fs.writeFileSync(path.join(directory, name+'.html'), html);
}

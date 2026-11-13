// 从原始文件精确截取分类源码。--refresh 才覆盖已拆源码，日常重建不覆盖手工调整。
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const base=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(base,'index.html'),'utf8');
const parts=[
 ['../原有场景/源码/材质库.js','var qg={};','var $g={};'],
 ['../原有场景/源码/道具库.js','var $g={};','var cv={};'],
 ['../原有场景/源码/场景组合.js','var cv={};','var mv={};'],
 ['../原有场景/源码/港口背景.js','var mv={};','var vv={};'],
 ['../原有场景/源码/地面天气.js','var vv={};','var Sv={};'],
 ['../特效/源码/粒子与贴花.js','var Sv={};','var vt=Math.PI*2;'],
 ['../音效/源码/合成与播放.js','var vt=Math.PI*2;','function v_('],
 ['../武器/源码/枪械与手部.js','var Xv={};','var ex={};'],
 ['../角色/源码/机械角色与动作.js','var ex={};','var tx=4,'],
 ['../UI/源码/HUD.js','var tx=4,','var fM='],
 ['../UI/源码/菜单.js','var fM=','var gM=']
];
for(const [file,start,end] of parts){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<0)throw Error('源码锚点不匹配：'+file);
 const dest=path.resolve(__dirname,file);fs.mkdirSync(path.dirname(dest),{recursive:true});
 if(!fs.existsSync(dest)||process.argv.includes('--refresh'))fs.writeFileSync(dest,source.slice(a,b));
}
fs.writeFileSync(path.join(__dirname,'源码分段.json'),JSON.stringify(parts.map(([file,start,end])=>({file,start,end})),null,2));
const css=source.slice(source.indexOf('<style>')+7,source.indexOf('</style>'));
fs.writeFileSync(path.join(base,'素材/UI/原有样式.css'),css);
// 合成内核不依赖 WebGL，可独立离线试听及生成 WAV。
const a=source.indexOf('var vt=Math.PI*2;'),b=source.indexOf('var pi=',a);
fs.writeFileSync(path.join(base,'素材/音效/音频合成.js'),'(()=>{\n'+source.slice(a,b)+'\nwindow.alongAudio={catalog:Object.fromEntries(Object.entries(Go).map(([id,s])=>[id,{variants:s.n,sr:s.sr,loop:!!s.loop,ir:!!s.ir}])),synthesize:r_};\n})();');
fs.writeFileSync(path.join(__dirname,'原始文件校验.json'),JSON.stringify({file:'index.html',sha256:crypto.createHash('sha256').update(source).digest('hex'),sourceParts:parts.length},null,2));
console.log('分类源码 '+parts.length+' 段；原始文件未写入。');

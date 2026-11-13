// Dependency-free MCP stdio server + loopback editor bridge. No client-supplied shell execution.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),readline=require('node:readline');
const {validate,exportHtml,root}=require('./map-core.cjs');
const guideRoot=path.join(root,'docs/ai素材指南');
const guide=()=>fs.readdirSync(guideRoot).filter(n=>n.endsWith('.md')).map(n=>'\n# '+n+'\n'+fs.readFileSync(path.join(guideRoot,n),'utf8')).join('\n');
const receipt=crypto.createHash('sha256').update(guide()).digest('hex');let hasRead=false,events=[],revision=0;
const descriptors=[
 {name:'read_guidance',description:'必须首先调用。根据用户请求和参考图读取可配置指导，返回 guidanceToken。',inputSchema:{type:'object',properties:{requestContext:{type:'string'},referenceImages:{type:'array'},requirements:{type:'object'}}}},
 {name:'list_assets',description:'查询可复用素材及实际工厂，不应重新发明现有道具。',inputSchema:{type:'object',properties:{kind:{type:'string'}}}},
 {name:'validate_map',description:'检查晴天、米制变换、底板、双方出生点、四边封闭空气墙。',inputSchema:{type:'object',properties:{project:{type:'object'}},required:['project']}},
 {name:'create_map',description:'遵照 read_guidance 组建地图，验证通过后保存工程及单文件 HTML 并通知编辑器。工厂在渲染器中执行。',inputSchema:{type:'object',properties:{guidanceToken:{type:'string'},project:{type:'object'}},required:['guidanceToken','project']}},
 {name:'create_asset',description:'遵照指导生成一个 HTML 素材（不是规范）。必须有写实风格参考、工厂、材质槽、碰撞。保存后通知编辑器。',inputSchema:{type:'object',properties:{guidanceToken:{type:'string'},html:{type:'string'}},required:['guidanceToken','html']}}
];
function catalog(){const code=fs.readFileSync(path.join(__dirname,'assets.js'),'utf8');return JSON.parse(code.slice(code.indexOf('=')+1).trim().replace(/;$/,''));}
function checkFactory(code){if(typeof code!=='string'||!code.trim())throw Error('工厂不能为空');if(/\b(?:window|document|parent|globalThis|process|require|import|fetch|XMLHttpRequest|WebSocket|eval|Function|Worker|localStorage|setTimeout|setInterval)\b|constructor\s*\[?|__proto__|https?:\/\//.test(code))throw Error('工厂包含不允许的系统/网络/动态执行代码');new Function('ctx',code);}
// 说明性指南不足以阻止模型提交“几个方盒拼接”的占位素材；这里执行可验证的最低质量门槛。
function validateAssetQuality(meta,code){
 const kind=String(meta.assetKind||meta.kind||'prop').toLowerCase(), source=String(code);
 const mesh=(source.match(/new\s+T\.Mesh\s*\(/g)||[]).length;
 const componentCalls=(source.match(/\b(?:add|part|component|body|box|contour|cz|cx)\s*\(/g)||[]).length;
 const geometry=(source.match(/new\s+T\.(?:Box|Cylinder|Sphere|Capsule|Cone|Torus|Extrude|Shape|Lathe|Tube|Buffer)Geometry\s*\(/g)||[]).length;
 if(!geometry)throw Error('素材必须创建可见的真实几何体，不能只返回空 Group');
 const slots=(source.match(/alongSlot\s*=/g)||[]).length+(source.match(/alongSlots\s*=/g)||[]).length;
 if(slots<2)throw Error('素材至少需要两个可区分的材质槽，并为部件设置 alongSlot');
 const requireWords=(words,label)=>{const missing=words.filter(w=>!new RegExp(w,'i').test(source));if(missing.length)throw Error(`${label}缺少必要部件：${missing.join('、')}`);};
 if(kind==='weapon'){
   if(mesh+componentCalls<8||geometry<3)throw Error('武器细节不足：至少需要 8 个独立 Mesh 和 6 个几何部件，禁止用少量方盒代替整枪');
   requireWords(['muzzle|barrel','receiver|body','grip|handle','stock|butt','sight|optic','magazine|mag|drum','trigger|guard'],'武器');
   if(!/CylinderGeometry|ExtrudeGeometry|Shape|TubeGeometry/i.test(source))throw Error('武器必须同时使用圆柱/挤压/曲线等非方盒几何表现枪管、轮廓或附件');
   if(!/metalness|roughness|vertexColors|MeshPhysicalMaterial|MeshStandardMaterial/i.test(source))throw Error('武器必须声明金属度、粗糙度或顶点颜色材质参数');
   if((source.match(/(?:弹链|belt|链条|link)/gi)||[]).length && (source.match(/(?:弹匣|magazine|magwell|drum)/gi)||[]).length>2)throw Error('武器供弹结构冲突：不得同时堆叠弹链与弹匣/弹鼓，必须声明唯一 feed 类型');
   if(!/alongAnchors\s*=/.test(source)||!/alongColliders\s*=/.test(source))throw Error('武器必须独立提供 alongAnchors 与 alongColliders 业务数据');
   if(!/partType|parentPart|mount|magwell|topRail|handguardRail/i.test(source))throw Error('武器必须声明功能挂载关系，配件不能悬浮');
   const boxes=(source.match(/new\s+T\.BoxGeometry\s*\(/g)||[]).length;
   if(boxes>18 && !/ExtrudeGeometry|TubeGeometry|LatheGeometry/i.test(source))throw Error('武器主体过度依赖方盒，必须用截面挤压或曲线扫掠建立连续轮廓');
 }
 if(kind==='character'||kind==='person'){
   if(mesh<8||geometry<6)throw Error('人物细节不足：至少需要头部、躯干、双臂、双腿和装备等 8 个独立 Mesh');
   requireWords(['head|helmet','body|torso|spine','arm','hand|glove','leg','foot|boot'],'人物');
 }
 if(kind==='building'||kind==='prop'){
   if(mesh<3||geometry<3)throw Error('道具/建筑结构不足：至少需要 3 个可见部件，不能提交空壳或单一方块');
 }
 if(kind==='material'){
   if(mesh<3||geometry<3)throw Error('材质预览不足：必须提供至少三种形状的真实预览面，不能只展示一个球或一块平面');
   if(!/roughness|metalness|normalMap|color/i.test(source))throw Error('材质必须声明颜色、粗糙度、金属度或纹理参数');
 }
}
const eventFile=path.join(root,'.along-editor-events.json');
function readEvents(){try{const stored=JSON.parse(fs.readFileSync(eventFile,'utf8'));if(Array.isArray(stored)){events=stored;revision=events.at(-1)?.revision||0;}}catch{}}
function emit(type,data){readEvents();revision=Math.max(Date.now(),revision+1);events.push({revision,type,...data});events=events.slice(-200);const tmp=eventFile+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(events));fs.renameSync(tmp,eventFile);}
function toolCall(name,args={}){
 if(name==='read_guidance'){hasRead=true;const context=args.requestContext||'',refs=Array.isArray(args.referenceImages)?args.referenceImages:[];return {guidanceToken:receipt,instructions:guide()+'\n本次任务上下文：'+context+'；参考图数量：'+refs.length+'。先用 list_assets 判断缺少素材；缺少的素材必须先 create_asset，再 create_map。天气、风格和布局以用户请求及参考图为准。\n地图额外规则：weather 必须是字符串（晴天示例值为 sunny）；design.playableBounds={min:[x,z],max:[x,z]}；底板顶面 Y=0；双方 role=spawn，team=进攻方/防守方；四边必须有从地面到至少4米、接缝重叠的空气墙；出生点有掩体且至少相隔8米；三条可绕行通路，宽度至少2米。提交前在编辑器检查真实渲染、碰撞与可达性。不得用占位插画冒充缩略图。人物应有服装褶皱、战术背心、弹袋、头盔、护目镜、手套、护膝、鞋靴。'};}
 if(name==='list_assets')return {assets:catalog().filter(a=>!args.kind||a.kind===args.kind)};
 if(name==='plan_map'){if(!hasRead||args.guidanceToken!==receipt)throw Error('先调用 read_guidance');const text=String(args.requestContext||'').toLowerCase(),refs=Array.isArray(args.referenceImages)?args.referenceImages:[],all=catalog(),wanted=[];if(/汤姆逊|thompson/.test(text))wanted.push('ai.thompson1928');if(/人物|士兵|战术|小队/.test(text))wanted.push('builtin.training-dummy');const existing=wanted.map(id=>all.find(a=>a.id===id)).filter(Boolean);return {workflow:'先补素材，后组装地图',referenceImages:refs.length,requiredAssetIds:wanted,existingAssets:existing.map(a=>({id:a.id,name:a.name})),createBeforeMap:wanted.filter(id=>!existing.some(a=>a.id===id)),notes:'参考图只用于分析风格和缺口；新素材必须包含真实预览图。'};}
 if(name==='validate_map')return {valid:validate(args.project).length===0,errors:validate(args.project)};
 if(!hasRead||args.guidanceToken!==receipt)throw Error('先调用 read_guidance 并遵照指导，传入返回的 guidanceToken');
 if(name==='create_map'){
  const p=args.project,errors=validate(p);if(errors.length)throw Error(errors.join('\n'));for(const o of p.objects)if(!o.airwall)checkFactory(o.factory);
  const name=p.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,70);const dir=path.join(root,'地图');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,name+'.along-map.json'),JSON.stringify(p,null,2));fs.writeFileSync(path.join(dir,name+'.html'),exportHtml(p));emit('map',{project:p});return {saved:['地图/'+name+'.along-map.json','地图/'+name+'.html'],objects:p.objects.length,revision};
 }
 if(name==='create_asset'){
  const html=args.html;if(typeof html!=='string'||html.length>2e6)throw Error('HTML 必须小于2MB');
  const meta=html.match(/<script\s+id="along-asset"\s+type="application\/json">([\s\S]*?)<\/script>/),factory=html.match(/<script\s+id="along-factory"\s+type="text\/plain">([\s\S]*?)<\/script>/);if(!meta||!factory)throw Error('缺少素材元数据或工厂');const a=JSON.parse(meta[1]);
  if(a.sourceAssetId||a.cloneOf){const sourceId=a.sourceAssetId||a.cloneOf;if(!catalog().some(x=>x.id===sourceId))throw Error('sourceAssetId 必须指向现有素材');if(a.id===sourceId)throw Error('AI 只能复制成新 id，禁止修改已有素材');a.cloneOf=sourceId;}
  if(!a.id?.startsWith('ai.')||!a.name||!a.visualStyle||!a.styleReference||a.units!=='m')throw Error('缺少 ai. 前缀 id、名称、风格参考或米单位');checkFactory(factory[1]);if(!factory[1].includes('alongColliders')||!factory[1].includes('alongSlot'))throw Error('必须定义碰撞和材质槽');validateAssetQuality(a,factory[1]);if(!a.previewImage||!/^data:image\/(png|jpeg|webp);base64,/.test(a.previewImage))throw Error('不允许缺少 previewImage；新素材必须提供本地 base64 PNG/JPEG/WebP，不能使用远程图片');
  const dir=path.join(root,'素材/AI生成');fs.mkdirSync(dir,{recursive:true});const file=a.id.replace(/[^a-zA-Z0-9_.-]/g,'_')+'.html',dest=path.join(dir,file);if(fs.existsSync(dest))throw Error('素材已存在，请使用新 id/version，避免覆盖');
  // Only the validated JSON and factory are executable input. Ignore any extra scripts in supplied document.
  const body='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>'+a.name.replace(/[<>&]/g,'')+'</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style><iframe id="preview"></iframe><header hidden><h1 id="asset-title"></h1><p id="status"></p></header><script id="along-asset" type="application/json">'+JSON.stringify(a).replace(/</g,'\\u003c')+'</script><script id="along-factory" type="text/plain">'+factory[1]+'</script><script src="../公共/素材预览.js"></script></html>';
  fs.writeFileSync(dest,body);const asset={...a,kind:a.kind||'prop',factory:factory[1],path:'素材/AI生成/'+file,custom:true};const assets=catalog();assets.push(asset);fs.writeFileSync(path.join(__dirname,'assets.js'),'window.ALONG_ASSETS='+JSON.stringify(assets)+';\n');emit('asset',{asset});return {saved:asset.path,revision};
 }throw Error('未知工具：'+name);
}
function rpc(req){if(req.method==='initialize')return {protocolVersion:'2024-11-05',capabilities:{tools:{},resources:{}},serverInfo:{name:'along-map-editor',version:'1.0.0'},instructions:'必须先 read_guidance，遵守全部规则；所有地图必须有两队出生点、底板、封闭空气墙。'};if(req.method==='tools/list')return {tools:descriptors};if(req.method==='tools/call'){try{return {content:[{type:'text',text:JSON.stringify(toolCall(req.params.name,req.params.arguments))}]};}catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}}if(req.method==='resources/list')return {resources:[{uri:'along://guidance',name:'素材和地图生成指导',mimeType:'text/plain'}]};if(req.method==='resources/read')return {contents:[{uri:'along://guidance',mimeType:'text/plain',text:guide()}]};if(req.method==='ping')return {};throw Error('不支持的方法');}
function start(port=8765){
 const server=http.createServer((req,res)=>{
  const host=req.headers.host;if(!['127.0.0.1:'+port,'localhost:'+port].includes(host)){res.writeHead(403);res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:'+port);if(req.headers.origin&&req.headers.origin!==url.origin&&req.headers.origin!=='http://localhost:'+port){res.writeHead(403);res.end();return;}
  if(url.pathname==='/api/status'){readEvents();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({name:'along-map-editor',revision,root}));return;}
  if(url.pathname==='/api/events'){readEvents();res.setHeader('Content-Type','application/json');res.end(JSON.stringify(events.filter(e=>e.revision>Number(url.searchParams.get('after')||0))));return;}
  if(url.pathname==='/api/maps'&&req.method==='GET'){const dir=path.join(root,'地图');let maps=[];try{maps=fs.readdirSync(dir).filter(n=>n.endsWith('.along-map.json')).map(file=>{let project={};try{project=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));}catch{};const st=fs.statSync(path.join(dir,file));return {file,name:project.name||file.replace(/\.along-map\.json$/,''),mtime:st.mtimeMs,objectCount:Array.isArray(project.objects)?project.objects.length:0};});}catch{}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({maps}));return;}
  if(url.pathname==='/api/maps'&&req.method==='DELETE'){const file=String(url.searchParams.get('file')||'');if(!/^[^\\/:*?"<>|]+\.along-map\.json$/.test(file)){res.writeHead(400);res.end('invalid file');return;}const target=path.resolve(root,'地图',file);if(path.dirname(target)!==path.resolve(root,'地图')){res.writeHead(403);res.end();return;}try{fs.unlinkSync(target);const html=target.replace(/\.along-map\.json$/,'.html');if(fs.existsSync(html))fs.unlinkSync(html);res.end(JSON.stringify({ok:true}));}catch{res.writeHead(404);res.end('not found');}return;}
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/编辑器/launcher.html':url.pathname));}catch{res.writeHead(400);res.end();return;}
  const relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(v=>v.startsWith('.'))){res.writeHead(403);res.end();return;}
  fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'})[path.extname(file)]||'text/plain; charset=utf-8');res.end(data);});
 });server.listen(port,'127.0.0.1',()=>process.stderr.write('沿线编辑器：http://127.0.0.1:'+port+'/编辑器/\n'));return server;
}
if(require.main===module){const serveOnly=process.argv.includes('--serve'),server=start(Number(process.env.ALONG_EDITOR_PORT)||8765);server.on('error',error=>{if(error.code==='EADDRINUSE'&&!serveOnly){process.stderr.write('编辑器服务已在运行，通过本地事件文件同步生成结果。\n');}else{process.stderr.write(error.message+'\n');process.exitCode=1;}});if(!serveOnly){readline.createInterface({input:process.stdin}).on('line',line=>{let req;try{req=JSON.parse(line);if(req.id===undefined)return;const result=rpc(req);process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result})+'\n');}catch(e){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req?.id||null,error:{code:-32603,message:e.message}})+'\n');}}).on('close',()=>server.close());}}
module.exports={rpc,toolCall,start,checkFactory,validateAssetQuality};

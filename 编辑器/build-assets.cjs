const fs=require('node:fs'),path=require('node:path');
const {toolCall}=require('./mcp-server.cjs');const token=toolCall('read_guidance').guidanceToken;
const wrap=(meta,code,preview='../公共/素材预览.js')=>`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${meta.name}</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}header{position:fixed;left:12px;top:12px;background:#152124dd;color:white;padding:12px;font:14px system-ui}</style><iframe id="preview"></iframe><header><h1 id="asset-title"></h1><p id="status"></p></header><script id="along-asset" type="application/json">${JSON.stringify(meta)}</script><script id="along-factory" type="text/plain">${code}</script><script src="${preview}"></script></html>`;
const thompson=`const T=ctx.THREE,r=new T.Group();
const steel=ctx.original.material('gunmetal'),black=ctx.original.material('steel_dark'),wood=ctx.original.material('wood_dark');
function box(w,h,d,x,y,z,mat,slot){const m=new T.Mesh(new T.BoxGeometry(w,h,d,2,2,2),mat);m.position.set(x,y,z);m.userData.alongSlot=slot;m.castShadow=true;m.receiveShadow=true;r.add(m);return m;}
function cyl(radius,length,x,y,z,mat,axis='z',slot='steel'){const m=new T.Mesh(new T.CylinderGeometry(radius,radius,length,24),mat);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;m.position.set(x,y,z);m.userData.alongSlot=slot;m.castShadow=true;r.add(m);return m;}
box(.058,.086,.3,0,.23,-.035,steel,'receiver');box(.048,.034,.20,0,.288,-.048,black,'receiver');
box(.05,.053,.15,0,.19,.055,steel,'receiver');
cyl(.018,.28,0,.245,-.315,steel);for(let i=0;i<22;i++)cyl(.024,.004,0,.245,-.20-i*.007,black);
cyl(.023,.045,0,.245,-.478,steel);cyl(.026,.014,0,.245,-.501,black);box(.012,.026,.015,0,.278,-.48,black,'sights');
box(.014,.032,.035,0,.318,.065,black,'sights');box(.035,.008,.045,0,.301,.065,steel,'sights');
// Walnut buttstock, foregrip and pistol grip, full-size 1928 pattern.
const stock=box(.055,.102,.245,0,.185,.265,wood,'walnut');stock.rotation.x=-.14;box(.06,.11,.014,0,.165,.39,black,'buttplate');
const grip=box(.043,.112,.052,0,.124,.10,wood,'walnut');grip.rotation.x=-.27;
const fore=box(.042,.112,.051,0,.148,-.255,wood,'walnut');fore.rotation.x=.16;
const drum=cyl(.071,.045,0,.135,-.09,black,'x','magazine');cyl(.055,.049,0,.135,-.09,steel,'x','magazine');cyl(.014,.052,0,.135,-.09,black,'x','magazine');
const guard=new T.Mesh(new T.TorusGeometry(.032,.003,8,24,Math.PI*1.65),steel);guard.rotation.y=Math.PI/2;guard.position.set(0,.139,.025);guard.userData.alongSlot='trigger';r.add(guard);const trigger=box(.004,.032,.006,0,.15,.025,black,'trigger');trigger.rotation.x=-.3;
box(.012,.014,.055,.034,.254,-.025,steel,'bolt');box(.025,.012,.012,.042,.254,0,black,'bolt');
for(const z of [-.14,.055,.15])for(const x of [-.031,.031])cyl(.004,.003,x,.237,z,black,'x','rivets');
for(let i=0;i<8;i++)box(.0008,.013,.04,.0291,.205+i*.003,.26+i*.005,black,'grain');
r.userData.alongSlots=['receiver','steel','walnut','magazine','sights','trigger','buttplate','bolt','rivets','grain'].map(id=>({id,name:id}));r.userData.alongColliders=[{min:[-.05,.06,-.52],max:[.05,.34,.41],surface:'metal',purpose:'occupancy'}];r.userData.alongAnchors={muzzle:[0,.245,-.52],grip:[0,.14,.1],sight:[0,.32,.065]};return r;`;
const meta={schema:'along.html-asset/1',id:'ai.thompson1928',name:'汤姆逊 M1928 · 胡桃木与钢制弹鼓',kind:'weapon',assetKind:'weapon',version:'1.0.0',units:'m',visualStyle:'realistic',styleReference:'沿线港口写实磨损金属与胡桃木，M1928实物比例'};
if(!fs.existsSync(path.join(__dirname,'../素材/AI生成/ai.thompson1928.html')))console.log(toolCall('create_asset',{guidanceToken:token,html:wrap(meta,thompson)}));
const soldier=`const T=ctx.THREE,r=new T.Group();
const cloth=new T.MeshStandardMaterial({color:0x626857,roughness:.96});
const dark=new T.MeshStandardMaterial({color:0x515747,roughness:.98});
const nylon=new T.MeshStandardMaterial({color:0x8e8265,roughness:.92});
// Fine weave is a real procedural texture, not a flat color or unrelated illustration.
const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,v=218+((x*17+y*13)%13)+(x%2===0?8:0);pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255;}const weave=new T.DataTexture(pixels,64,64);weave.wrapS=weave.wrapT=T.RepeatWrapping;weave.repeat.set(8,8);weave.needsUpdate=true;cloth.map=weave;dark.map=weave;nylon.map=weave;
// Multiscale ripstop camouflage with cloth grain, shared across jacket and trousers.
const camoData=new Uint8Array(256*256*4),palette=[[148,145,113],[97,112,83],[60,73,58],[173,164,128],[113,108,83]];
for(let y=0;y<256;y++)for(let x=0;x<256;x++){const field=Math.sin(x*.071+Math.sin(y*.046)*3)+Math.cos(y*.085+Math.sin(x*.038)*4)+Math.sin((x+y)*.16)*.32,index=Math.min(4,Math.max(0,Math.floor((field+2.35)*1.06))),c=palette[index],noise=((x*31+y*17)%11)-5,grid=x%16===0||y%16===0?-8:0,i=(y*256+x)*4;for(let k=0;k<3;k++)camoData[i+k]=c[k]+noise+grid;camoData[i+3]=255;}
const camo=new T.DataTexture(camoData,256,256);camo.wrapS=camo.wrapT=T.RepeatWrapping;camo.repeat.set(1.5,1.5);camo.needsUpdate=true;camo.colorSpace=T.SRGBColorSpace;cloth.color.setHex(0xffffff);cloth.map=camo;cloth.bumpMap=weave;cloth.bumpScale=.0012;nylon.bumpMap=weave;nylon.bumpScale=.0008;
const rubber=ctx.original.material('rubber'),metal=ctx.original.material('steel_worn'),glass=ctx.original.material('glass_dirty').clone();glass.color.setHex(0x333d3b);
const skin=new T.MeshStandardMaterial({color:0xac8c71,roughness:.94});
function mesh(geo,mat,pos,slot='uniform'){const m=new T.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;m.userData.alongSlot=slot;r.add(m);return m;}
function box(w,h,d,p,mat=nylon,slot='webbing'){const shape=new T.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();const bevel=Math.min(.004,w/8,h/8,d/8),g=new T.ExtrudeGeometry(shape,{depth:d-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1});g.translate(0,0,-d/2+bevel);return mesh(g,mat,p,slot);}
function ell(rx,ry,rz,p,mat=cloth,slot='uniform'){const m=mesh(new T.SphereGeometry(1,24,16),mat,p,slot);m.scale.set(rx,ry,rz);return m;}
function limb(a,b,ra,rb,mat=cloth,slot='uniform'){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),geo=new T.CylinderGeometry(rb,ra,d.length(),24,14);if(mat===cloth){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i),angle=Math.atan2(p.getZ(i),p.getX(i)),fold=1+.055*Math.sin(y*130+angle*2)+.028*Math.sin(y*211-angle*3);p.setXYZ(i,p.getX(i)*fold,y,p.getZ(i)*fold);}geo.computeVertexNormals();}const m=mesh(geo,mat,av.clone().add(bv).multiplyScalar(.5).toArray(),slot);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
// Human proportions, tailored torso, bent knees and rifle-ready shoulders.
const profile=[[.13,.91],[.17,1.00],[.185,1.16],[.20,1.35],[.185,1.42],[.09,1.48]].map(([x,y])=>new T.Vector2(x,y));const body=mesh(new T.LatheGeometry(profile,32),cloth,[0,0,0]);body.scale.z=.66;
ell(.17,.115,.12,[0,.94,.015]);
box(.30,.32,.062,[0,1.25,-.132],nylon,'armor');box(.30,.32,.065,[0,1.25,.124],nylon,'armor');
for(const side of [-1,1]){
 box(.056,.14,.045,[side*.128,1.435,-.03],nylon);box(.048,.35,.035,[side*.18,1.25,.015],nylon);
 const x=side*.105;const knee=[x+side*.023,.53,-.035],ankle=[x+side*.065,.13,.015];
 limb([x,.91,.015],knee,.097,.078);ell(.085,.085,.075,knee,cloth);
 limb(knee,ankle,.07,.052);ell(.068,.085,.032,[knee[0],.54,-.094],rubber,'kneepads');
 box(.135,.029,.12,[knee[0],.54,-.064],dark);ell(.077,.081,.14,[ankle[0],.085,-.055],rubber,'boots');box(.145,.025,.245,[ankle[0],.022,-.052],rubber,'boots');
 for(let i=0;i<5;i++){const lace=box(.095,.006,.009,[ankle[0],.134-i*.009,-.035-i*.014],nylon,'laces');lace.rotation.y=side*.18;}
 box(.078,.13,.035,[x+side*.075,.76,.03],cloth);box(.075,.025,.04,[x+side*.075,.81,.026],dark);
 // Cloth folds follow joints rather than perfect smooth cylinders.
 for(let i=0;i<5;i++){const f=ell(.073,.007,.060,[knee[0],.64+i*.028,-.003],cloth);f.rotation.z=side*(i%2?.18:-.14);}
 for(let i=0;i<4;i++)ell(.054,.006,.048,[ankle[0],.20+i*.022,.015],cloth);
}
// Plate carrier: sewn MOLLE rows, individually divided magazine pouches and closures.
for(let row=0;row<6;row++)for(let c=0;c<6;c++)box(.034,.008,.006,[-.126+c*.05,1.115+row*.041,-.169],dark);
for(const x of [-.102,0,.102]){box(.083,.13,.048,[x,1.155,-.191],nylon);box(.087,.025,.054,[x,1.22,-.197],dark);box(.014,.035,.006,[x,1.20,-.227],rubber);for(const edge of [-1,1])box(.003,.10,.002,[x+edge*.037,1.15,-.216],dark);}
box(.107,.07,.018,[-.065,1.355,-.174],dark,'patch');for(let i=0;i<4;i++)box(.074,.003,.003,[-.065,1.333+i*.014,-.185],nylon,'patch');
box(.075,.165,.052,[.19,1.31,-.02],dark,'radio');box(.05,.04,.013,[.19,1.355,-.053],rubber,'radio');limb([.19,1.37,.01],[.20,1.68,.015],.003,.002,rubber,'radio');
box(.21,.27,.095,[0,1.24,.195],nylon,'backpack');box(.16,.12,.05,[0,1.17,.261],dark,'backpack');for(const x of [-.07,.07])box(.015,.24,.012,[x,1.24,.25],dark);
box(.34,.043,.24,[0,.99,0],dark,'belt');box(.05,.037,.016,[0,.99,-.135],metal,'belt');for(const x of [-.14,.14])box(.053,.08,.045,[x,.96,-.12],nylon);
// Flexed arms hold a compact patrol rifle across the chest.
const joints=[[[.21,1.40,0],[.285,1.15,-.08],[.135,1.17,-.29]],[[-.21,1.40,0],[-.29,1.20,-.12],[-.12,1.23,-.36]]];
for(const [a,b,c] of joints){ell(.09,.095,.085,a);limb(a,b,.078,.063);ell(.068,.058,.068,b,dark,'elbow');limb(b,c,.061,.046);ell(.049,.052,.055,c,dark,'gloves');for(let i=0;i<4;i++)ell(.009,.025,.012,[c[0]+(i-1.5)*.018,c[1]-.012,c[2]-.034],rubber,'gloves');}
// Face under balaclava, goggles, high-cut helmet shell, rails and NVG mount.
limb([0,1.46,0],[0,1.58,0],.066,.064,dark,'balaclava');ell(.10,.125,.09,[0,1.64,0],dark,'balaclava');ell(.079,.027,.019,[0,1.67,-.081],skin,'face');
const helmet=mesh(new T.SphereGeometry(.122,32,20,0,Math.PI*2,0,Math.PI*.58),nylon,[0,1.726,.005],'helmet');helmet.scale.z=1.07;
ell(.119,.015,.119,[0,1.695,.005],dark,'helmet');
for(const side of [-1,1]){box(.027,.036,.09,[side*.115,1.718,.006],rubber,'helmet');ell(.028,.051,.034,[side*.111,1.647,.015],rubber,'headset');limb([side*.10,1.65,-.025],[side*.055,1.57,-.08],.006,.006,dark,'chinstrap');}
for(const x of [-.045,.045]){box(.082,.045,.028,[x,1.675,-.091],rubber,'goggles');box(.067,.033,.006,[x,1.675,-.108],glass,'goggles');}box(.02,.022,.036,[0,1.674,-.085],nylon,'goggles');
box(.04,.051,.015,[0,1.742,-.112],metal,'nvg');box(.053,.021,.018,[0,1.766,-.12],rubber,'nvg');
limb([-.12,1.645,-.01],[-.125,1.60,-.08],.004,.004,rubber,'headset');limb([-.125,1.60,-.08],[-.04,1.59,-.115],.004,.004,rubber,'headset');
// Patrol rifle has distinct receiver, magazine, barrel and adjustable stock.
const gun=box(.25,.06,.045,[.005,1.245,-.345],metal,'rifle');box(.12,.052,.042,[.18,1.245,-.345],rubber,'rifle');limb([-.34,1.25,-.345],[-.12,1.25,-.345],.011,.011,metal,'rifle');box(.048,.09,.035,[.015,1.18,-.345],rubber,'rifle');box(.045,.028,.035,[-.02,1.29,-.345],rubber,'rifle');for(let i=0;i<8;i++)box(.006,.008,.05,[-.11+i*.015,1.281,-.345],rubber,'rifle');
r.userData.alongSlots=['uniform','webbing','armor','kneepads','boots','laces','patch','radio','backpack','belt','elbow','gloves','face','balaclava','helmet','headset','chinstrap','goggles','nvg','rifle'].map(id=>({id,name:id}));r.userData.alongColliders=[{min:[-.38,0,-.4],max:[.38,1.86,.31],surface:'actor',purpose:'occupancy'}];r.userData.alongPreviewBounds={min:[-.4,0,-.42],max:[.4,1.86,.32]};return r;`;
fs.writeFileSync(path.join(__dirname,'../素材/角色/训练假人.html'),wrap({schema:'along.html-asset/1',id:'builtin.training-dummy',name:'港区战术小队 · 全装巡逻兵',kind:'actor',assetKind:'character',version:'2.0.0',units:'m',visualStyle:'realistic',styleReference:'战术小队比例；沿线港区磨损布料与哑光装备'},soldier));
console.log('已直接更新当前训练假人模型');

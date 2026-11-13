const {toolCall}=require('./mcp-server.cjs');
const token=toolCall('read_guidance').guidanceToken;
const p={schema:'along.map-project/2',name:'晴日港区集装箱争夺',weather:'sunny',teams:{attackers:'进攻方 · 西仓储区',defenders:'防守方 · 东装卸区',objective:'争夺中央装卸区'},design:{description:'依据用户港区航拍布局：北侧海港与吊机，中部平行箱阵与装卸通道，南侧分隔小院。',playableBounds:{min:[-70,-49],max:[70,49]},routes:['西侧仓储绕行','中央装卸通道','东侧长廊'],minimumRouteWidth:2,exportMode:'独立离线自由观察 HTML'},objects:[]};
let index=0;function add(name,factory,position=[0,0,0],rotation=[0,0,0],extra={}){const o={id:'port-'+ ++index,name,kind:'prop',factory,position,rotation,scale:[1,1,1],...extra};p.objects.push(o);return o;}
function block(w,h,d,material){return `const T=ctx.THREE,r=new T.Group(),m=new T.Mesh(new T.BoxGeometry(${w},${h},${d}),ctx.original.material('${material}'));m.position.y=${h/2};m.castShadow=true;m.receiveShadow=true;r.add(m);m.userData.alongSlot='body';r.userData.alongSlots=[{id:'body',name:'主体'}];r.userData.alongColliders=[{min:[${-w/2},0,${-d/2}],max:[${w/2},${h},${d/2}],surface:'concrete'}];return r;`;}
add('港区沥青底板',`const T=ctx.THREE,r=new T.Group(),data=new Uint8Array(128*128*4);let seed=42;for(let i=0;i<128*128;i++){seed=(seed*1664525+1013904223)>>>0;const v=100+(seed%24);data[i*4]=v;data[i*4+1]=v+2;data[i*4+2]=v+3;data[i*4+3]=255;}const tex=new T.DataTexture(data,128,128);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(65,45);tex.needsUpdate=true;const mat=new T.MeshStandardMaterial({color:0x899090,map:tex,roughness:.95}),m=new T.Mesh(new T.BoxGeometry(1,1,1),mat);m.position.y=-.5;m.receiveShadow=true;m.userData.alongSlot='ground';r.add(m);r.userData.alongSlots=[{id:'ground',name:'地面'}];r.userData.alongColliders=[{min:[-.5,-1,-.5],max:[.5,0,.5],surface:'asphalt'}];return r;`,[0,0,0],[0,0,0],{kind:'foundation',scale:[142,.6,100],foundationSize:[142,.6,100]});
add('北侧港池海面',`const T=ctx.THREE,r=new T.Group(),water=ctx.original.material('water_dark').clone();water.color.setHex(0x396b83);const m=new T.Mesh(new T.PlaneGeometry(1400,1000,30,16),water);m.rotation.x=-Math.PI/2;m.userData.alongSlot='water';r.add(m);r.userData.alongColliders=[];r.userData.alongSlots=[{id:'water',name:'海面'}];r.userData.alongUpdate=t=>{m.position.y=Math.sin(t*.6)*.012;};return r;`,[0,-.55,-550]);
add('码头岸壁',block(144,1.2,1.2,'concrete_dirty'),[0,-.6,-50]);
for(const x of [-69,69])add('港区周界实体墙',block(1,2,99,'concrete_dirty'),[x,0,0]);
add('南侧周界墙',block(140,2,1,'concrete_dirty'),[0,0,49]);
for(const x of [-51,-18,20,56])add('北侧岸桥吊机',`return ctx.original.backdrop('crane');`,[x,0,-41],[0,0,0],{kind:'assembly',scale:[.65,.65,.65]});
add('远处停泊货轮',`return ctx.original.backdrop('ship');`,[16,-.8,-88],[0,90,0],{kind:'assembly',scale:[.75,.75,.75]});
const colors=['paint_red','paint_blue','paint_white','paint_grey','paint_green'];
function container(x,z,seed,angle=0,stack=false){add('集装箱 · '+colors[seed%colors.length],`const r=ctx.original.prop('container40',{seed:${seed}});r.traverse(o=>{if(o.isMesh&&o.material?.name?.includes('paint'))o.material=ctx.original.material('${colors[seed%colors.length]}');});return r;`,[x,stack?2.6:0,z],[0,angle,0]);}
// Ordered center blocks, open 8m main lanes and offset flanks, like the reference port.
for(const x of [-27,-12,12,27])for(const z of [-26,-16,-6,4])container(x,z,index);
for(const x of [-27,-12,12])container(x,-26,index,0,true);
for(const x of [-55,-43,44,56])for(const z of [-27,-12,5,18])container(x+(z%2?2:0),z,index,z===5?90:0);
for(const x of [-55,-43,44])container(x,-27,index,0,true);
for(const [x,z,angle] of [[-42,31,0],[-52,38,0],[-10,28,0],[3,38,0],[31,31,90]])container(x,z,index,angle);
for(const [x,z,w,d] of [[-54,31,27,.6],[-40,38,.6,20],[-20,31,.6,20],[13,32,.6,22],[38,39,20,.6]])add('南侧分隔矮墙',block(w,1.8,d,'concrete_dirty'),[x,0,z]);
for(const [x,z] of [[-62,22],[58,34]])add('港区门卫室',`return ctx.original.prop('guard_booth',{seed:7});`,[x,0,z],[0,90,0]);
for(const [x,z] of [[-34,-31],[35,-22],[-59,11],[36,15]])add('堆放托盘',`return ctx.original.prop('pallet_stack',{seed:7});`,[x,0,z]);
for(const [x,z] of [[-60,-38],[62,-39],[40,38],[-34,18]])add('照明灯杆',`return ctx.original.prop('light_mast',{seed:7});`,[x,0,z]);
for(const [x,z] of [[-33,10],[34,-10]])add('叉车',`return ctx.original.prop('forklift',{seed:7});`,[x,0,z],[0,90,0]);
add('磨损停车线与装卸区标线',`const T=ctx.THREE,r=new T.Group(),mat=ctx.original.material('paint_yellow');function line(w,d,x,z){const m=new T.Mesh(new T.BoxGeometry(w,.012,d),mat);m.position.set(x,.014,z);r.add(m);}for(const x of [-34,-20,-5,5,20,35])line(.09,45,x,-10);for(let x=-62;x<65;x+=8){line(4,.12,x,15);line(4,.12,x,-36);}for(const z of [24,43])line(22,.1,-4,z);line(.1,19,-15,33);line(.1,19,7,33);r.userData.alongColliders=[];return r;`);
function spawn(team,color,x,z,yaw){add(team+'出生点',`const T=ctx.THREE,r=new T.Group(),mat=new T.MeshBasicMaterial({color:${color}});const disk=new T.Mesh(new T.CylinderGeometry(1.5,1.5,.04,40),mat);disk.position.y=.03;r.add(disk);const arrow=new T.Mesh(new T.ConeGeometry(.4,1.2,3),mat);arrow.rotation.x=-Math.PI/2;arrow.position.set(0,.09,-.5);r.add(arrow);r.userData.alongColliders=[];return r;`,[x,0,z],[0,yaw,0],{kind:'spawn',role:'spawn',team});}
spawn('进攻方','0x3be4b2',-61,40,90);spawn('防守方','0xff795e',60,40,-90);
add('中央目标点',`const T=ctx.THREE,r=new T.Group(),m=new T.Mesh(new T.RingGeometry(2.2,2.35,48),new T.MeshBasicMaterial({color:0xffce65,side:T.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.y=.025;r.add(m);r.userData.alongColliders=[];return r;`,[0,0,-8],[0,0,0],{kind:'objective'});
for(const [position,size] of [[[0,6,-49],[142,12,1]],[[0,6,49],[142,12,1]],[[-70,6,0],[1,12,100]],[[70,6,0],[1,12,100]]])add('封闭空气墙','',position,[0,0,0],{kind:'airwall',airwall:true,airwallSize:size});
console.log(toolCall('create_map',{guidanceToken:token,project:p}));

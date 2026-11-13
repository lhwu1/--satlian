# AI 素材生成指南（唯一入口）

读完此文件即可生成所有类别素材。

---

## 一、总规则

### 禁止
- 不改 index.html，不用网络资源，不生成额外文件
- 工厂代码写在 `<script id="along-factory" type="text/plain">` 里，**纯函数体，不包 function**
- Three.js 通过 `ctx.THREE` 注入，工厂必须 `return root`
- 不访问 window/document/eval

### 执行环境
```
new Function('ctx', factory)({THREE, original})
```

### 视觉
- 默认写实风格，参考沿线港区资产和 PAC-9 枪械
- 坐标：米、Y 向上、右手系、枪口沿 -Z
- 武器原点在**机匣几何中心**（弹匣正上方），地面道具在底面中心，角色在双脚中点

---

## 二、HTML 模板（复制即用）

```html
<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>中文名</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#15191d;color:#eee;font:14px sans-serif}iframe{width:100%;height:100%;border:0}header{position:fixed;left:12px;top:12px;padding:10px;background:#111c;border-radius:6px}h1,p{margin:0}h1{font-size:16px}p{margin-top:4px}</style></head>
<body><iframe id="preview"></iframe><header><h1 id="asset-title"></h1><p id="status">加载中</p></header>
<script id="along-asset" type="application/json">
{"schema":"along.html-asset/1","id":"ai.xxx","name":"中文名","version":"1.0.0","category":"武器","assetKind":"weapon","origin":"AI生成","units":"m","visualStyle":"realistic","styleReference":"参考沿线港区 PAC-9 写实风格"}
</script>
<script id="along-factory" type="text/plain">
const T=ctx.THREE; const root=new T.Group();
// === 工厂代码 ===
return root;
</script>
<script src="../公共/素材预览.js"></script>
</body></html>
```

---

## 三、质感四件套（武器必用）

### 1.1 顶点颜色（颗粒感，必用）

原始 PAC-9 的做法：vertexColors: true + 给每个顶点一个 0.9~1.0 范围的微调系数。**baseColor × noise = 最终颜色**。

```javascript
function hash(x,y,z){return Math.sin(x*12.9898+y*78.233+z*37.719)*43758.5453-Math.floor(Math.sin(x*12.9898+y*78.233+z*37.719)*43758.5453);}
function injectNoise(geo){
  geo.computeVertexNormals();
  const pos=geo.attributes.position, col=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
    const f=0.9+0.1*hash(Math.round(pos.getX(i)*70),Math.round(pos.getY(i)*70),Math.round(pos.getZ(i)*70));
    col[i*3]=f;col[i*3+1]=f;col[i*3+2]=f;
  }
  geo.setAttribute('color',new T.BufferAttribute(col,3));
}
```

材质声明：`new T.MeshStandardMaterial({vertexColors:true, metalness, roughness})`

### 1.2 Shape + ExtrudeGeometry（bevel 倒角，必用）

BoxGeometry 的边缘是直角，像塑料玩具。ExtrudeGeometry + bevel 产生金属冲压件圆角。

```javascript
function extrudeZ(shape, depth, bevelSize){
  bevelSize=bevelSize||0.002;
  const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevelSize,bevelSize:bevelSize,bevelOffset:-bevelSize,bevelSegments:1,steps:1,curveSegments:8});
  geo.rotateY(Math.PI/2); return geo;
}
```

### 1.3 基色选择

baseColor 不要太暗也不要太亮。因为 vertexColors 是乘法（0.9~1.0），实际颜色 ≈ baseColor。建议：

| 材质 | baseColor (hex) | roughness | metalness |
|------|-----------------|-----------|-----------|
| 阳极氧化金属 | #1a1a1e | 0.40 | 0.45 |
| 磷酸盐发黑钢 | #141416 | 0.50 | 0.70 |
| 蓝化钢（枪管） | #0e1114 | 0.38 | 0.85 |
| 聚合物（护木） | #121214 | 0.62 | 0.00 |
| 橡胶 | #0a0a0a | 0.92 | 0.00 |

**注意**：不要用 #3a3a3a 这种亮灰当金属基色。太亮会显塑料感。

### 1.4 瞄准镜镜片（光学瞄具用）

用 ShaderMaterial 可以模拟玻璃 + 瞄准分划线 + 天空反射。如果懒得写 Shader，用带 emissive 的 MeshStandardMaterial 也行：

```javascript
const lensMat = new T.MeshStandardMaterial({
  color: 0x1a2a3a, metalness: 0.2, roughness: 0.15,
  emissive: 0x0a0a20, emissiveIntensity: 0.3,
  transparent: true, opacity: 0.9
});
```

---

## 四、武器装配方法论（先看这节）

### 原点与装配逻辑

**先定原点位置**：原点 = 机匣几何中心（弹匣正上方、枪管下方的交汇点）。从原点出发，所有部件坐标都是正数或负数偏移，**部件之间必须在边界处精确相接**。

**RPK-74 装配坐标参考**（原点 `(0, 0, 0)` 在机匣中心）：

| 部件 | position | 说明 |
|------|----------|------|
| 机匣 receiver | `(0, 0.02, 0)` | 截面宽 0.044 高 0.042，深 0.22 |
| 枪管 barrel | `(0, 0.04, -0.32)` | 从机匣前端接出，沿 -Z 方向长 0.45 |
| 枪管节套 ext | `(0, 0.04, -0.075)` | 连接机匣和枪管 |
| 枪口制退器 brake | `(0, 0.04, -0.57)` | 最前端 |
| 导气箍 gasBlock | `(0, 0.057, -0.33)` | 枪管上方，导气管前端 |
| 导气管 gasTube | `(0, 0.077, -0.22)` | 长圆柱，从 gasBlock 延伸到机匣前端 |
| 前准星 frontSight | `(0, 0.09, -0.33)` | gasBlock 上方 |
| 护木 handguard | `(0, 0.04, -0.18)` | 枪管下方包裹，底部开口 |
| 弹鼓 drum | `(0, -0.042, -0.08)` | 机匣正下方，圆柱形 |
| 握把 grip | `(0, -0.055, 0.072)` | 机匣后下方，约 75° 角 |
| 扳机护圈 guard | `(0, -0.012, 0.055)` | 握把前方 |
| 枪托 stock | `(0, 0.02, 0.35)` | 从机匣后端接出，沿 +Z 方向延伸 |
| 顶部导轨 railTop | `(0, 0.066, -0.03)` | 机匣顶面 |
| 瞄具 scope | `(0, 0.073, 0.01)` | 导轨上方 |

### 每个部件的 shape 截面要点

- 截面在 XY 平面定义（因为 extrudeZ 会 rotateY(PI/2) 把截面转到 XZ 平面）
- 截面宽度 = 部件左右宽度（X 方向），高度 = 部件上下高度（Y 方向）
- 挤压 depth = 部件前后长度（Z 方向）
- bevelSize = 0.0015~0.003（金属冲压感）

### alongAnchors

```javascript
root.userData.alongAnchors = {
  muzzle:      [0, 0.040, -0.578],  // 枪口最前端（射线起点）
  sight:       [0, 0.073,  0.010],  // 瞄具中心（开镜时对齐光轴）
  grip:        [0,-0.055,  0.072],  // 握把握持中心
  stock:       [0, 0.020,  0.494],  // 枪托抵肩点
  supportGrip: [0,-0.060, -0.240]   // 前握把中心
};
```

**sightY 合理范围**：机械瞄具 0.060~0.075，光学瞄具 0.065~0.085。

### alongSlots & alongColliders

每个部件至少一个 slot + 一个 AABB。collider surface: metal | polymer | rubber | airwall。

---

## 五、反例清单（禁止 AI 做的）

| 反例 | 正确做法 |
|------|----------|
| 所有部件用 BoxGeometry | 大部件用 extrudeZ（Shape+ExtrudeGeometry+bevel） |
| baseColor 设 #3a3a3a 以上亮灰 | 金属基色在 #1a1a1e 级别，极暗 |
| 部件位置随手写，互相分离（散架） | 先算好原点，部件之间在边界精确相接 |
| 只有 5~8 个大部件 | 至少 15 个以上独立部件，和 PAC-9 密度同级 |
| 弹匣悬空不在机匣正下方 | 弹匣中心 Z 应在机匣弹匣口的 Z 位置 |
| 枪管和机匣之间有间隙 | 枪管节套连接两端，没有缝 |
| 枪托是一根圆柱 | 枪托 = 金属管 + 聚合物主体 + 橡胶垫 |
| 瞄具是个方块 | 瞄具 = 镜筒(Cylinder) + 环 + 基座 + 镜片 |
| CylinderGeometry 不用 injectNoise | 所有 Mesh 都要 injectNoise |
| vertexColors 范围 0.7~1.2 | 0.9~1.0 足够 |
| 光学瞄具用纯 MeshStandardMaterial | 要么用 ShaderMaterial，要么给 emissive |
| 握把垂直向下没有角度 | 握把与枪管轴线夹角 70°~80°，截面有弧度 |
| 护木全长一样粗 | 通常后端粗前端细，或前后有阶梯 |

---

## 六、检查清单

### 结构
- [ ] 所有部件位置正确，没有散架
- [ ] 枪管从机匣前端接出，枪管节套连接机匣和枪管
- [ ] 弹匣在机匣正下方
- [ ] 握把在机匣后下方，夹角 70°~80°
- [ ] 枪托从机匣后端延伸

### 质感
- [ ] 所有 Mesh 用了 vertexColors
- [ ] 所有 Mesh 调用了 injectNoise
- [ ] 大部件用了 extrudeZ 带 bevel
- [ ] 金属基色在 #1a1a1e 左右（不亮）
- [ ] 光学瞄具有镜片处理

### 锚点
- [ ] alongAnchors 有 muzzle, sight, grip
- [ ] sightY 在 0.06~0.09 范围
- [ ] 坐标是局部坐标

### 格式
- [ ] HTML 单文件
- [ ] factory 返回 Object3D
- [ ] 不访问 window/document
- [ ] 不用可选链 ?. 等新语法

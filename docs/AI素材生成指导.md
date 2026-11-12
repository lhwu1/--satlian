# 沿线 AI 素材 HTML 生成指导

把本文与用户的素材需求一起交给 AI。目标是**每次输出一个完整 HTML 文件，代表一个可复用的三维素材**；用户把它放入 `素材/AI生成/` 后，未来的地图编辑器通过协议发现、预览、拖拽和实例化。编辑器目前尚未实现，不能声称已经自动识别或导入成功。

## 基本要求

- 仅输出一个完整 HTML 代码块，不生成整张游戏或多个文件。素材可以是人物、武器、箱子、建筑、地图片段、标点或材质样板；地图片段应是可拼装的三维模块，完整地图由用户在编辑器组装并导出。
- 素材包含完整几何和材质；建筑有厚度、背面、入口和必要的碰撞，不能把一张平面当完整建筑。先满足用户要求的比例、风格和可进入性，再补细节。
- 素材几何与材质在工厂函数中生成；禁止 CDN、任何 HTTP/HTTPS/WebSocket 外链、远程字体、外部模型、外部贴图、外部音频和追踪代码，不能通过 `fetch`、XHR、动态导入、`sendBeacon`、图片或 CSS URL 等方式间接下载。可用代码生成 Canvas 纹理，不引用本机绝对路径。素材唯一允许的外部脚本是模板中的项目内相对路径 `../公共/素材预览.js`；它由项目提供，编辑器不会依赖素材自带的其他脚本。使用共享 Three.js，由 `ctx.THREE` 注入，不再加载第二份引擎。地图导出必须内嵌必要运行时和素材。
- 禁止改写原始游戏文件。不得访问或修改页面 DOM、`window`、`parent`、`localStorage`、Cookie、文件系统，不得使用 `eval`、`Function`、WebWorker、定时器、渲染循环、相机、全局事件、网络或系统接口；工厂只使用 `ctx.THREE` 和局部计算。需要程序化纹理时，可仅用 `document.createElement('canvas')` 创建不附加到页面的 Canvas，不能用它访问页面其他内容。编辑器有权拒绝不符合要求的素材；文字规则和静态扫描不能保证不可信代码安全，应在隔离环境预览。多个实例之间的变换和材质替换互不影响。尽量复用同一实例的几何与材质，避免高面数和大量实时光源。
- 可见几何、材质和碰撞应位于对象局部坐标中。坐标右手系、X 右、Y 上，单位米；地面物件底面中心为原点。局部碰撞盒由 `root.userData.alongColliders` 给出，数组元素形如 `{min:[x,y,z],max:[x,y,z],surface:'metal'}`。门洞不要被整面碰撞盒堵住；非实体标记可以使用空数组。编辑器为空气墙另外提供工具。
- `id` 使用 `ai.` 加小写字母、数字、下划线，例如 `ai.wood_crate`；`version` 使用 `1.0.0` 格式。明确素材名称和分类，不得与现有 ID 冲突。不要假设未知的原有素材 ID 或 API 可以使用。
- 生成的是可执行 HTML，只应导入可信素材。导出器需把所用公共运行时、素材和资源内嵌进地图 HTML；不要声称编辑器已经实现这一功能或已经测试通过。

## 必须包含的结构

1. `<script id="along-asset" type="application/json">`：包含 `schema`（固定 `along.html-asset/1`）、`id`、`name`、`version`、`category`、`assetKind`（`character`、`weapon`、`prop`、`building`、`marker`、`material` 之一）、`origin`（`AI生成`）和 `units`（`m`）。旧版原有素材可能没有 `assetKind`，导入器须兼容并提示待补充。
2. `<script id="along-factory" type="text/plain">`：仅写函数体，未来编辑器以参数 `ctx` 调用；必须返回 `THREE.Object3D`。材质直接建在其中，碰撞附在返回对象上。不能直接写 `</script>` 字符串到函数体。
3. HTML 正文包含 `iframe#preview`、`#asset-title`、`#status`，在上述两个数据块之后加载 `../公共/素材预览.js`；放在 `素材/AI生成/` 时此相对路径有效。预览器使用 `素材/公共/原场景运行时.html` 提供共享引擎。未来编辑器读取工厂内容，而不是把 iframe 当作素材。

复制下面的完整示例作为模板，按用户需求替换工厂与元数据：

```html
<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>练习木箱</title>
<style>html,body{margin:0;height:100%;background:#161c20;color:#fff;font:14px sans-serif}iframe{width:100%;height:100%;border:0}header{position:fixed;top:0;left:0;padding:12px;background:#10181cbb}h1{font-size:18px;margin:0 0 5px}p{margin:0}</style></head>
<body><iframe id="preview" title="素材预览"></iframe>
<header><h1 id="asset-title"></h1><p id="status">正在加载素材…</p></header>
<script id="along-asset" type="application/json">
{"schema":"along.html-asset/1","id":"ai.wood_crate","name":"练习木箱","version":"1.0.0","category":"道具","assetKind":"prop","origin":"AI生成","units":"m"}
</script>
<script id="along-factory" type="text/plain">
const T = ctx.THREE;
const root = new T.Group();
const wood = new T.MeshStandardMaterial({color:0x795332,roughness:0.9});
const frame = new T.MeshStandardMaterial({color:0x483325,roughness:0.8});
const body = new T.Mesh(new T.BoxGeometry(1,1,1),wood);
body.userData.alongSlot='wood';
body.position.y=0.5; root.add(body);
for (const x of [-0.43,0.43]) {
  const strip=new T.Mesh(new T.BoxGeometry(0.09,1.04,1.04),frame);
  strip.userData.alongSlot='frame';
  strip.position.set(x,0.5,0); root.add(strip);
}
root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
root.userData.alongColliders=[{min:[-0.5,0,-0.52],max:[0.5,1.02,0.52],surface:'wood'}];
root.userData.alongSlots=[{id:'wood',name:'箱体木材'},{id:'frame',name:'加固条'}];
return root;
</script>
<script src="../公共/素材预览.js"></script>
</body></html>
```

## 材质替换接口

每个可换材质的 Mesh 设置 `mesh.userData.alongSlot = '槽位ID'`；同槽位多块网格可以一起更换。根节点设置 `root.userData.alongSlots` 数组，每项为 `{id:'body',name:'主体'}`，ID 在该素材内唯一，只用小写字母、数字、下划线。每个槽位至少有一个 Mesh，所有 Mesh 均有可见的默认材质；只支持单材质 Mesh，混合材质时拆分网格。编辑器会按槽位替换材质，因此不要把需独立更换颜色的部件合并到一个槽。每次调用工厂均创建独立材质，避免给一个实例换材质时改变其他实例。Canvas 程序纹理自包含，不依赖外部图片。材质样板也必须返回可预览网格、默认材质和槽位，方便编辑器提取材质。

## 人物与武器

- **人物**：输出完整可见的三维人物（头、躯干、手臂、腿、前后与侧面），局部原点为双脚中点，Y 向上，面朝 `-Z`。按用途和用户要求给出尺寸，不把面片或单独头部当整个人。默认站立姿态；使用命名 `Group` 构成可摆姿态层级：`hips` → `spine` → `head`，`spine` 下有 `arm_l`、`arm_r`，`hips` 下有 `leg_l`、`leg_r`；左右均以人物自身为准。各组原点设在关节处，网格是对应组子节点，允许未来旋转关节。至少把皮肤、衣服、装备分成可换材质槽。提供覆盖身体的一个或多个碰撞盒；这些盒用于初始占位，不等于移动控制器或精确命中判定。动画、蒙皮、换装接口未实现，除非用户另有要求，不声称已有走跑或射击动作。
- **武器**：输出完整可见的枪身与用户要求的零件，局部枪口方向为 `-Z`、Y 向上；枪身、金属件、握把等按需分材质槽。根节点设置 `root.userData.alongAnchors`，包含 `muzzle`、`grip`、`sight` 三个局部坐标数组，供后续绑定和瞄准；若需要持枪绑定，也可增加 `supportGrip`。武器在地图中作为摆件时提供覆盖实体的碰撞盒，不能把枪口位置当作碰撞盒。武器外形不包含射击、后坐力、伤害、联网逻辑，也不保证第一人称视角自动对准；后续运行时负责对齐并验证。
- 人物持枪、动画、精确碰撞和多人同步属于后续运行时工作；不要假装生成素材就自动具备。人物和武器分别输出一个 HTML，组装时通过命名关节和锚点连接。编辑器与加载器仍需实现并验证这些约定。

## 提交前自查

确认 HTML 完整、JSON 合法，工厂能使用注入的 Three.js 返回对象；尺寸合理、默认材质和可更换槽位齐全、碰撞覆盖实体且不堵入口；人物关节或武器锚点符合要求；无额外文件、外链和禁止的 API。列出未实测的事项。不要声称图片预览、编辑器导入或地图导出已验证，除非确实运行过。

用户提示词模板：

> 按《沿线 AI 素材 HTML 生成指导》输出一个 HTML 素材。我需要：[素材名称、用途、外形、风格]；实际尺寸：[米]；是否需要进入或碰撞：[要求]。素材将放在 `素材/AI生成/`，供地图编辑器拖拽复用。请输出完整 HTML。

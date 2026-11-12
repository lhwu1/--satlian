/* 璁粌瀹炰綋鐙珛浜庝换鍔℃晫浜虹郴缁燂紱涓嶇敓鎴愭敾鍑昏涓烘垨淇敼浠撳簱缁撴瀯銆?*/
class RangeTargets {
  constructor(game, markers) {
    this.g = game;
    this.T = game.THREE;
    this.markers = markers;
    this.items = [];
    this.pool = null;
    this.poolPromise = null;
    this.clock = 0;
    this.ray = new this.T.Raycaster();
    this.ray.camera = game.camera;
  }

  async prepareMovers() {
    if (!this.poolPromise) this.poolPromise = this.g.createTrainingActors().then(pool => {
      this.pool = pool;
      // 璁粌姹犵嫭绔嬫洿鏂帮紝鍘熸垬鏂楁ā鍧椾粛鎸佹湁绌虹殑鏁屼汉鍒楄〃銆?      pool.debug.ctx.fireBolt = () => {};
      pool.debug.ctx.provoke = () => {};
      pool.update=()=>{};
      return pool;
    }).catch(error => { this.poolPromise = null; throw error; });
    return this.poolPromise;
  }

  clear() {
    this.pool?.clear();
    if(this.pool)this.pool.clear=()=>{};
    for (const item of this.items) {
      if (item.sprite) {
        item.sprite.removeFromParent();
        item.sprite.material.map.dispose();
        item.sprite.material.dispose();
      }
      item.marker.remove();
    }
    this.items = [];
  }

  marker(label) {
    const node = document.createElement('div');
    node.className = 'h-wm';
    node.hidden = true;
    node.innerHTML = '<i></i><b></b><span></span>';
    node.querySelector('b').textContent = label;
    this.markers.appendChild(node);
    return node;
  }

  free(position, radius = .36, height = radius) {
    return !this.g.physics.boxes.some(box =>
      position.x + radius > box.min.x && position.x - radius < box.max.x &&
      position.z + radius > box.min.z && position.z - radius < box.max.z &&
      position.y + height > box.min.y && position.y - height < box.max.y);
  }

  visible(position, eye, visual = false) {
    const direction = position.clone().sub(eye), distance = direction.length();
    if (distance < 3) return false;
    direction.divideScalar(distance);
    if (this.g.physics.raycast(eye, direction, distance + .02)) return false;
    if (visual) {
      this.ray.set(eye, direction);
      this.ray.far = distance + .02;
      if (this.ray.intersectObject(this.g.level.root, true).length) return false;
    }
    return true;
  }

  validStatic(position, visual = false) {
    // 鍙湪浠撳簱鍐呴儴銆佸钩鍙板墠鏂圭殑寮€鏀剧┖闂寸敓鎴愶紱闈跺績楂樹簬骞冲彴鍦版澘銆?    if (position.x < -8.8 || position.x > 9.8 || position.z < -26.5 || position.z > -12.5 || position.y < 3.15 || position.y > 5.4) return false;
    if (!this.free(position, .38)) return false;
    if (this.items.some(item => item.pos.distanceTo(position) < 1)) return false;
    const screen=position.clone().project(this.g.camera);
    if(this.items.some(item=>{
      const other=item.pos.clone().project(this.g.camera);
      return Math.hypot((screen.x-other.x)*innerWidth/2,(screen.y-other.y)*innerHeight/2)<58;
    }))return false;
    const eye = this.g.camera.position;
    const platformEye = new this.T.Vector3(-12.8, 4.2, -23.15);
    for (const offset of [[0,0,0],[.26,0,0],[-.26,0,0],[0,.26,0],[0,-.26,0]]) {
      const point = position.clone().add(new this.T.Vector3(...offset));
      if (!this.visible(point, eye) || !this.visible(point, platformEye)) return false;
    }
    return !visual || this.visible(position, eye, true) && this.visible(position, platformEye, true);
  }

  staticBatch() {
    this.clear();
    this.g.scene.updateMatrixWorld(true);
    const candidates=[];
    for(let x=-8;x<=9;x+=1.15)for(let z=-25.8;z<=-13;z+=1.15)for(const y of [3.25,4.05,4.9,5.3])candidates.push(new this.T.Vector3(x+(Math.random()-.5)*.3,y,z+(Math.random()-.5)*.3));
    for (let n=candidates.length-1;n>0;n--) {
      const j=Math.floor(Math.random()*(n+1));
      [candidates[n],candidates[j]]=[candidates[j],candidates[n]];
    }
    for(const position of candidates) {
      if (!this.validStatic(position, true)) continue;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const ctx=canvas.getContext('2d');
      for(const [r,color] of [[60,'#ff2525'],[44,'#650909'],[29,'#ff2525'],[11,'#fff0f0']]) {
        ctx.fillStyle=color;ctx.beginPath();ctx.arc(64,64,r,0,Math.PI*2);ctx.fill();
      }
      const texture=new this.T.CanvasTexture(canvas);
      const sprite=new this.T.Sprite(new this.T.SpriteMaterial({map:texture,depthTest:true,transparent:true,toneMapped:false}));
      sprite.name='璁粌绾㈤澏';sprite.position.copy(position);sprite.scale.set(.48,.48,1);
      this.g.scene.add(sprite);
      this.items.push({pos:sprite.position,sprite,marker:this.marker(String.fromCharCode(65+this.items.length))});
      if(this.items.length===10) break;
    }
    return this.items.length;
  }

  route(flying) {
    const y=5.1+Math.random()*1.1,z=-23.5+Math.random()*2;
    const left=-8+Math.random()*2,right=6+Math.random()*2;
    return [new this.T.Vector3(left,y,z),new this.T.Vector3(right,y+.3,z-.8),new this.T.Vector3(right-.4,y-.2,z+.8),new this.T.Vector3(left,y,z)];
  }

  movingBatch() {
    this.clear();
    if(!this.pool) throw new Error('移动靶模型尚未准备完成');
    const route=this.route(true), actor=this.pool.spawn('gull',route[0].clone(),{passive:true,hover:5.2,patrolRadius:.01,yaw:Math.PI/2});
    if(!actor) throw new Error('无人机模型不可用');
    this.items.push({actor,pos:actor.pos,route,phase:Math.random(),marker:this.marker('无人机'),alive:true});
  }
  step(dt, speed, running) {
    if(running && this.pool && this.items.some(item=>item.actor)) {
      this.clock+=dt*speed;
      for(const item of this.items) if(item.actor) {
        const a=item.actor;
        a.passive=true;a.mode='patrol';a.home.copy(a.pos);a.patrolR=.01;
        const route=item.route; const t=(this.clock*.12+item.phase)%2, u=t<=1?t:2-t; const scaled=u*(route.length-1), idx=Math.min(route.length-2,Math.floor(scaled)), frac=scaled-idx; a.pos.copy(route[idx]).lerp(route[idx+1],frac); a.pos.y+=Math.sin(this.clock*1.6+item.phase)*.15; a.yaw=Math.atan2(route[idx+1].x-route[idx].x,route[idx+1].z-route[idx].z);
        if(a.rig?.group){a.rig.group.position.copy(a.pos);a.rig.group.rotation.y=a.yaw;}
      }
    }
    const camera=this.g.camera,w=innerWidth,h=innerHeight;
    camera.updateMatrixWorld();
    for(const item of this.items) {
      item.marker.hidden = this.items.length > 3;
      if(item.marker.hidden)continue;
      const point=item.pos.clone();
      const view=point.clone().applyMatrix4(camera.matrixWorldInverse);
      const ndc=point.clone().project(camera);
      let x=ndc.x,y=ndc.y;
      if(view.z>=0){x=-x;y=-y;}
      const edge=view.z>=0||Math.abs(x)>.91||Math.abs(y)>.82;
      if(edge) {const factor=Math.max(Math.abs(x)/.91,Math.abs(y)/.82,1);x/=factor;y/=factor;}
      item.marker.classList.toggle('offscreen',edge);
      item.marker.style.transform=`translate(${Math.max(38,Math.min(w-38,(x+1)*w/2))}px,${Math.max(80,Math.min(h-40,(1-y)*h/2-(!edge?25:0)))}px)`;
      item.marker.querySelector('span').textContent=(edge?'鏂瑰悜 路 ':'')+Math.round(point.distanceTo(camera.position))+' m';
    }
  }

  hit() {
    this.g.camera.updateMatrixWorld(true);
    this.ray.setFromCamera(new this.T.Vector2(0,0),this.g.camera);
    const origin=this.ray.ray.origin,dir=this.ray.ray.direction;
    const wall=this.g.physics.raycast(origin,dir,100);
    let nearest=null,distance=wall?.dist??100;
    this.g.scene.updateMatrixWorld(true);
    for(const item of this.items) {
      if(item.sprite) {
        this.ray.far=distance;
        const hit=this.ray.intersectObject(item.sprite)[0];
        if(hit&&hit.distance<distance){
          const uv=hit.uv;
          if(uv&&Math.hypot(uv.x-.5,uv.y-.5)>.47)continue;
          nearest=item;distance=hit.distance;
        }
      } else {
        const to=item.pos.clone().sub(origin),along=to.dot(dir);if(along>0&&along<distance&&Math.sqrt(Math.max(0,to.lengthSq()-along*along))<.85){nearest=item;distance=along;}
      }
    }
    if(!nearest) return false;
    if(nearest.sprite) {
      nearest.sprite.removeFromParent();nearest.sprite.material.map.dispose();nearest.sprite.material.dispose();
      nearest.marker.remove();this.items.splice(this.items.indexOf(nearest),1);
    } else {
      nearest.alive=false;if(nearest.actor.rig?.group)nearest.actor.rig.group.visible=false;nearest.marker.remove();this.items.splice(this.items.indexOf(nearest),1);this.pool?.clear();
    }
    return true;
  }
}







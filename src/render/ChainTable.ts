import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {PhysicalYarn, type Vector, type PhysicsFrame} from '../core/yarnPhysics';

export const COLORWAYS:Record<string,string>={
  blue:'#73a9d3',cream:'#e8d2ac',rose:'#cf8e9c',sage:'#8eaa92',lavender:'#9f90bf'
};
const xyz=(p:Vector)=>new THREE.Vector3(p.x,p.y,p.z);
const metal=new THREE.MeshStandardMaterial({color:'#d5dce0',metalness:.83,roughness:.23});
const woodHandle=new THREE.MeshStandardMaterial({color:'#bb8566',metalness:0,roughness:.57});
const paper=new THREE.MeshStandardMaterial({color:'#e7d8c0',roughness:1});
function fiberTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const ctx=c.getContext('2d')!;
  ctx.fillStyle='#f3f2ef';ctx.fillRect(0,0,256,128);
  // Yarn fibres: soft 3-ply twist and short deterministic surface hairs.
  for(let k=-220;k<470;k+=19){
    ctx.strokeStyle='rgba(38,48,61,.27)';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(k,0);ctx.lineTo(k+116,128);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.62)';ctx.lineWidth=6;
    ctx.beginPath();ctx.moveTo(k+8,0);ctx.lineTo(k+124,128);ctx.stroke();
  }
  for(let i=0;i<800;i++){
    const x=(i*67)%256,y=(i*109)%128;
    ctx.fillStyle=i%3===0?'rgba(28,33,42,.14)':'rgba(255,255,255,.23)';
    ctx.fillRect(x,y,1+i%3,1);
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=8;return t;
}
function swept(points:THREE.Vector3[],radius:number,material:THREE.Material,closed=false){
  const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal',.45);
  const geo=new THREE.TubeGeometry(curve,Math.max(32,points.length*7),radius,10,closed);
  return new THREE.Mesh(geo,material);
}
function line(a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material){
  return swept([a,a.clone().lerp(b,.33),a.clone().lerp(b,.66),b],r,mat);
}
function createHook():THREE.Group{
  const g=new THREE.Group();
  // The working tip is at local origin and follows the captured bight.
  const hook=swept([
    new THREE.Vector3(-.06,-.06,.01),new THREE.Vector3(-.13,-.13,.02),
    new THREE.Vector3(-.16,-.01,.00),new THREE.Vector3(-.08,.045,.00),
    new THREE.Vector3(.10,.035,.01),new THREE.Vector3(.25,.055,.03),
    new THREE.Vector3(.49,.14,.06),new THREE.Vector3(1.9,.68,.12)
  ],.048,metal);g.add(hook);
  g.add(swept([
    new THREE.Vector3(.68,.20,.09),new THREE.Vector3(.98,.32,.10),
    new THREE.Vector3(1.4,.49,.11),new THREE.Vector3(1.88,.67,.12)
  ],.088,woodHandle));
  const nub=new THREE.Mesh(new THREE.SphereGeometry(.085,12,10),woodHandle);
  nub.position.set(1.88,.67,.12);g.add(nub);
  return g;
}
function needle(a:THREE.Vector3,b:THREE.Vector3,mat=metal){
  const group=new THREE.Group();
  const outer=line(a,b,.045,mat);group.add(outer);
  const end=new THREE.Mesh(new THREE.SphereGeometry(.10,16,12),new THREE.MeshStandardMaterial({color:'#b48064',roughness:.6}));
  end.position.copy(b);group.add(end);
  return group;
}
function makeSkein(color:string,texture:THREE.CanvasTexture):THREE.Group{
  const g=new THREE.Group();
  const body=new THREE.Mesh(
    new THREE.SphereGeometry(.74,48,32),
    new THREE.MeshStandardMaterial({color,map:texture,roughness:.97})
  );
  body.scale.set(1.05,.77,.61);
  g.add(body);
  const threadMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(.68),roughness:.95});
  // Curved windings around the ball are geometry, not an external art asset.
  for(let strand=0;strand<25;strand++){
    const points:THREE.Vector3[]=[];
    const rotation=strand*.24;
    for(let j=0;j<=64;j++){
      const theta=j/64*Math.PI*2;
      const rr=.69+.018*Math.sin(theta*7+strand);
      const x=rr*Math.cos(theta)*1.05;
      const y=rr*Math.sin(theta)*.77;
      const z=.31+strand*.006+.045*Math.sin(theta*2+rotation);
      points.push(new THREE.Vector3(x,y,z));
    }
    g.add(swept(points,.011,threadMaterial,true));
  }
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.56,.85),paper);
  label.position.set(0,0,.54);label.rotation.z=.27;g.add(label);
  const stripe=new THREE.Mesh(new THREE.PlaneGeometry(.46,.08),new THREE.MeshBasicMaterial({color:'#b78a70'}));
  stripe.position.set(0,.05,.55);stripe.rotation.z=.27;g.add(stripe);
  return g;
}
function makeAccessoryGroup(){
  const g=new THREE.Group();
  // Two knitting needles are placed aside as TABLE PROPS. Chain stitch is
  // worked by ONE active crochet hook; we must not fake two-hook crochet.
  const n1=needle(new THREE.Vector3(-5.65,2.0,.02),new THREE.Vector3(-3.40,3.31,.035));
  const n2=needle(new THREE.Vector3(-5.4,3.35,.065),new THREE.Vector3(-3.6,1.95,.065));
  g.add(n1,n2);
  // Folded paper pattern and a shallow tin with 3 stitch markers.
  const card=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.35),paper);
  card.position.set(-5.3,-1.7,-.12);card.rotation.z=-.18;g.add(card);
  const grid=new THREE.MeshBasicMaterial({color:'#baa58a'});
  for(let i=0;i<8;i++){
    const x=-5.83+i*.15;
    g.add(line(new THREE.Vector3(x,-2.53,-.105),new THREE.Vector3(x,-.85,-.105),.004,grid));
  }
  const tin=new THREE.Mesh(new THREE.CircleGeometry(.58,36),new THREE.MeshStandardMaterial({color:'#dac3ab',metalness:.4,roughness:.5}));
  tin.position.set(-4.88,-1.45,.035);g.add(tin);
  for(let i=0;i<4;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.115,.027,7,32),new THREE.MeshStandardMaterial({color:['#dda170','#8ba58d','#bba2c7','#e1c06f'][i],roughness:.47}));
    ring.position.set(-5.1+(i%2)*.34,-1.60+Math.floor(i/2)*.28,.065);
    ring.rotation.z=i*.7;g.add(ring);
  }
  return g;
}

export class ChainTable{
  readonly physics=new PhysicalYarn();
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,120);
  private controls:OrbitControls;
  private hook=createHook();
  private group=new THREE.Group();
  private yarn?:THREE.Mesh;
  private yarnShadow?:THREE.Mesh;
  private ball:THREE.Group;
  private fibers=fiberTexture();
  private yarnMat=new THREE.MeshStandardMaterial({
    color:COLORWAYS.blue,map:this.fibers,roughness:.94,metalness:0,side:THREE.DoubleSide
  });
  private shadowMaterial=new THREE.MeshBasicMaterial({color:'#2e211e',transparent:true,opacity:.19,depthWrite:false});
  private resizeObserver:ResizeObserver;
  private frameId=0;
  private startTime=0;
  private lengthMs=4100;
  private lastUpdate=0;
  private moving=false;
  private settleUntil=0;
  private showGuide=false;
  private guide:THREE.Mesh;
  onChange?:(count:number,busy:boolean)=>void;
  onComplete?:()=>void;
  constructor(private container:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.4;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera.position.set(0,-3.65,17.5);this.camera.lookAt(0,-.15,0);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.065;
    this.controls.enablePan=false;this.controls.minZoom=.7;this.controls.maxZoom=4;
    this.controls.minPolarAngle=0;this.controls.maxPolarAngle=Math.PI*.42;
    this.controls.maxAzimuthAngle=Math.PI*.36;
    this.controls.minAzimuthAngle=-Math.PI*.36;
    this.scene.add(new THREE.HemisphereLight(0xfff7e9,0x746756,2.0));
    const key=new THREE.DirectionalLight('#fff3d9',3.6);
    key.position.set(-3.8,4.2,9);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.left=-10;key.shadow.camera.right=10;
    key.shadow.camera.top=10;key.shadow.camera.bottom=-10;
    key.shadow.bias=-.0004;this.scene.add(key);
    const rim=new THREE.DirectionalLight('#d7e9ff',1.4);
    rim.position.set(6,-4,7);this.scene.add(rim);
    const matte=new THREE.Mesh(new THREE.PlaneGeometry(32,23),new THREE.ShadowMaterial({opacity:.23}));
    matte.position.z=-.31;matte.receiveShadow=true;this.scene.add(matte);
    this.scene.add(makeAccessoryGroup());
    this.ball=makeSkein(COLORWAYS.blue,this.fibers);
    this.ball.position.set(5.10,-2.10,.05);this.ball.rotation.z=-.33;
    this.ball.traverse(obj=>{if(obj instanceof THREE.Mesh)obj.castShadow=true;});
    this.scene.add(this.ball);
    this.hook.traverse(obj=>{if(obj instanceof THREE.Mesh)obj.castShadow=true;});
    this.scene.add(this.hook);
    const gmat=new THREE.MeshBasicMaterial({color:'#f7d29c',transparent:true,opacity:.55,depthTest:false});
    this.guide=new THREE.Mesh(new THREE.TorusGeometry(.25,.018,6,48),gmat);
    this.guide.visible=false;this.scene.add(this.guide);
    this.scene.add(this.group);
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(container);
    this.resize();this.updateRope(this.physics.frame);this.loop();
  }
  setSpeed(ms:number){this.lengthMs=Math.max(900,Math.min(6000,ms));}
  setColor(name:string){
    if(!COLORWAYS[name])return;
    this.yarnMat.color.set(COLORWAYS[name]);
    this.scene.remove(this.ball);
    this.ball=makeSkein(COLORWAYS[name],this.fibers);
    this.ball.position.set(5.10,-2.10,.05);this.ball.rotation.z=-.33;
    this.scene.add(this.ball);
  }
  setGuide(v:boolean){this.showGuide=v;this.guide.visible=v&&this.moving;}
  resetView(){
    this.camera.zoom=1;
    this.camera.position.set(0,-3.65,17.5);
    this.controls.target.set(0,-.15,0);
    this.camera.updateProjectionMatrix();this.controls.update();
  }
  start(){
    if(!this.physics.begin())return false;
    this.startTime=performance.now();this.moving=true;this.settleUntil=0;
    this.onChange?.(this.physics.completed,true);
    return true;
  }
  unravel(){
    if(this.moving){this.moving=false;}
    this.settleUntil=performance.now()+800;
    const ok=this.physics.unravel();
    this.updateRope(this.physics.frame);
    this.onChange?.(this.physics.completed,false);
    return ok;
  }
  reset(){
    this.moving=false;this.settleUntil=0;this.physics.reset();this.updateRope(this.physics.frame);
    this.onChange?.(0,false);this.resetView();
  }
  private resize(){
    const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);
    const hspan=4.8;
    this.camera.left=-hspan*w/h;
    this.camera.right=hspan*w/h;
    this.camera.top=hspan;
    this.camera.bottom=-hspan;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w,h,false);
  }
  private updateRope(frame:PhysicsFrame){
    if(this.yarn){
      this.group.remove(this.yarn);this.yarn.geometry.dispose();
    }
    if(this.yarnShadow){
      this.group.remove(this.yarnShadow);this.yarnShadow.geometry.dispose();
    }
    const path=frame.yarn.map(xyz);
    const curve=new THREE.CatmullRomCurve3(path,false,'centripetal',.38);
    const samples=Math.max(144,path.length*4);
    const geo=new THREE.TubeGeometry(curve,samples,.052,10,false);
    const length=curve.getLength();
    this.fibers.repeat.set(Math.max(8,Math.round(length*6)),1);
    this.fibers.needsUpdate=true;
    this.yarn=new THREE.Mesh(geo,this.yarnMat);
    this.yarn.castShadow=true;this.group.add(this.yarn);
    const shadowPts=path.map(p=>new THREE.Vector3(p.x+.06,p.y-.07,-.255));
    this.yarnShadow=swept(shadowPts,.052,this.shadowMaterial);
    this.group.add(this.yarnShadow);
    this.hook.position.copy(xyz(frame.hook));
    this.hook.rotation.z=frame.phase==='catch'?.15:frame.phase==='draw'?-.17:0;
    this.guide.position.copy(xyz(frame.active));
    this.guide.position.z=.45;
    this.guide.visible=this.showGuide&&this.moving;
  }
  private loop=()=>{
    this.frameId=requestAnimationFrame(this.loop);
    const now=performance.now();
    if(now-this.lastUpdate>29 && (this.moving || now<this.settleUntil)){
      const elapsed=Math.min(.033,Math.max(.002,(now-this.lastUpdate)/1000));
      this.lastUpdate=now;
      const t=Math.min(1,(now-this.startTime)/this.lengthMs);
      const eased=t*t*(3-2*t);
      if(this.moving)this.physics.setPullProgress(eased);
      this.physics.simulate(elapsed);
      this.updateRope(this.physics.frame);
      if(this.moving&&t>=1){
        this.physics.complete();this.moving=false;this.settleUntil=now+1400;
        this.updateRope(this.physics.frame);
        this.onChange?.(this.physics.completed,false);this.onComplete?.();
      }
    }
    this.controls.update();
    this.renderer.render(this.scene,this.camera);
  };
  dispose(){
    cancelAnimationFrame(this.frameId);this.resizeObserver.disconnect();
    this.controls.dispose();this.renderer.dispose();this.fibers.dispose();
  }
  get count(){return this.physics.completed;}
  get busy(){return this.moving;}
  get capacity(){return this.physics.maxCompleted;}
}

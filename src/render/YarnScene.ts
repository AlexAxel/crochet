
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildThread, type P3 } from '../core/geometry';
import type { Model } from '../core/model';

const vect = (p:P3)=>new THREE.Vector3(p.x,p.y,p.z);
const palette: Record<string,string> = {oat:'#d6b19d',cream:'#efddbc',sage:'#93a991',blue:'#85a8bd',rose:'#c58a9c',lavender:'#a68fb3'};
function fiberTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=128;c.height=128;
  const x=c.getContext('2d')!;x.fillStyle='#eee9e5';x.fillRect(0,0,128,128);
  for(let j=-130;j<260;j+=13){
    x.strokeStyle='rgba(62,56,53,.21)';x.lineWidth=3;x.beginPath();x.moveTo(j,0);x.lineTo(j+95,128);x.stroke();
    x.strokeStyle='rgba(255,255,255,.5)';x.lineWidth=4;x.beginPath();x.moveTo(j+5,0);x.lineTo(j+100,128);x.stroke();
  }
  for(let i=0;i<500;i++){x.fillStyle=i%2?'rgba(255,255,255,.16)':'rgba(30,20,15,.12)';x.fillRect(i*47%128,i*31%128,1,2);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
export class YarnScene {
  private scene=new THREE.Scene();
  private camera=new THREE.OrthographicCamera(-6,6,4,-4,.1,100);
  private renderer:THREE.WebGLRenderer;
  private controls:OrbitControls;
  private material=new THREE.MeshStandardMaterial({color:palette.oat,roughness:.96,map:fiberTexture(),side:THREE.DoubleSide});
  private yarn?:THREE.Mesh;
  private trailing?:THREE.Mesh;
  private tool:THREE.Group;
  private ball:THREE.Group;
  private debugGroup=new THREE.Group();
  private ro:ResizeObserver;
  private frame=0;
  private previousCount=0;
  private activeCurve?:THREE.CatmullRomCurve3;
  private start=0;
  private startFraction=1;
  private playing=false;
  constructor(private container:HTMLElement) {
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.3;
    this.container.append(this.renderer.domElement);
    this.camera.position.set(0,-2.2,15);this.camera.lookAt(0,0,0);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.enablePan=false;
    this.controls.minZoom=.55;this.controls.maxZoom=4;
    this.scene.add(new THREE.AmbientLight(0xffefe4,2.3));
    const light=new THREE.DirectionalLight(0xffffff,3);
    light.position.set(-4,6,9);this.scene.add(light);
    const fill=new THREE.DirectionalLight(0xa2c2d6,1.5);
    fill.position.set(5,-4,8);this.scene.add(fill);
    this.tool=this.createHook();this.scene.add(this.tool);
    this.ball=this.createBall();this.scene.add(this.ball);
    this.ball.position.set(4.45,-1.8,.17);
    this.scene.add(this.debugGroup);
    this.ro=new ResizeObserver(()=>this.resize());
    this.ro.observe(container);this.resize();this.animate();
  }
  private createHook(){
    const g=new THREE.Group();
    const curve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.14,-.11,.3),new THREE.Vector3(-.22,-.03,.35),
      new THREE.Vector3(-.16,.055,.33),new THREE.Vector3(-.04,.025,.35),
      new THREE.Vector3(.21,.08,.36),new THREE.Vector3(1.7,.64,.45)
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,64,.045,9),new THREE.MeshStandardMaterial({color:0xdbded9,metalness:.82,roughness:.22})));
    const grip=new THREE.CatmullRomCurve3([new THREE.Vector3(.71,.27,.4),new THREE.Vector3(1.16,.45,.44),new THREE.Vector3(1.7,.64,.45)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(grip,28,.086,12),new THREE.MeshStandardMaterial({color:0x9b674b,roughness:.75})));
    return g;
  }
  private createBall(){
    const g=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:this.material.color,map:fiberTexture(),roughness:1});
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(.53,32,24),mat);
    sphere.scale.set(1,.91,.68);g.add(sphere);
    for(let i=0;i<13;i++){
      const ps:THREE.Vector3[]=[];
      for(let j=0;j<=32;j++){
        const a=j/32*Math.PI*2;
        ps.push(new THREE.Vector3(.45*Math.cos(a),.37*Math.sin(a),.31+i*.006));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps),48,.009,4),this.material));
    }
    return g;
  }
  private resize(){
    const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);
    const f=4.05;this.camera.left=-f*w/h;this.camera.right=f*w/h;this.camera.top=f;this.camera.bottom=-f;
    this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
  }
  setColor(name:string){
    if(!palette[name])return;
    this.material.color.set(palette[name]);
    this.ball.traverse(obj=>{if(obj instanceof THREE.Mesh && obj.material!==this.material && obj.material instanceof THREE.MeshStandardMaterial) obj.material.color.set(palette[name]);});
  }
  showDebug(v:boolean){this.debugGroup.visible=v;}
  resetCamera(){this.controls.reset();this.camera.position.set(0,-2.2,15);this.controls.target.set(0,0,0);this.camera.zoom=1;this.camera.updateProjectionMatrix();}
  setModel(model:Model,withAnimation=true){
    const data=buildThread(model);
    if(this.yarn){this.scene.remove(this.yarn);this.yarn.geometry.dispose();}
    if(this.trailing){this.scene.remove(this.trailing);this.trailing.geometry.dispose();}
    this.yarn=undefined;
    if(data.points.length>=2){
      const curve=new THREE.CatmullRomCurve3(data.points.map(vect),false,'centripetal',.5);
      const map=this.material.map;
      if(map){map.repeat.set(Math.max(2,curve.getLength()*5),1);map.needsUpdate=true;}
      this.activeCurve=curve;
      this.yarn=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(120,data.points.length*8),.087,10),this.material);
      this.scene.add(this.yarn);
      this.startFraction=withAnimation&&this.previousCount>0&&this.previousCount<data.points.length?this.previousCount/data.points.length:1;
      this.playing=this.startFraction<1;this.start=performance.now();
    }
    if(data.points.length<2)this.activeCurve=undefined;
    this.previousCount=data.points.length;
    this.tool.position.copy(vect(data.tip));
    const tail=new THREE.CatmullRomCurve3([
      vect(data.tip),new THREE.Vector3(data.tip.x+.4,data.tip.y+.3,.35),
      new THREE.Vector3(3.5,-1,.3),new THREE.Vector3(4.2,-1.5,.3)
    ]);
    this.trailing=new THREE.Mesh(new THREE.TubeGeometry(tail,90,.045,8),this.material);
    this.scene.add(this.trailing);
    while(this.debugGroup.children.length){
      const child=this.debugGroup.children[0];this.debugGroup.remove(child);
      if(child instanceof THREE.Mesh) child.geometry.dispose();
    }
    for(const stitch of model.rows.flat()){
      const p=data.positionById.get(stitch.id);if(!p)continue;
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(.058,9,8),new THREE.MeshBasicMaterial({color:stitch.row===model.rows.length-1?0x3e876a:0x90735d,depthTest:false}));
      mesh.position.set(p.x,p.y,.52);this.debugGroup.add(mesh);
    }
    if(model.cursor>=0&&model.rows.length>1){
      const next=model.rows[model.rows.length-2][model.cursor];
      const p=data.positionById.get(next.id);
      if(p){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.23,.018,6,40),new THREE.MeshBasicMaterial({color:0xffdd83,depthTest:false}));
        ring.position.set(p.x,p.y,.58);this.debugGroup.add(ring);
      }
    }
  }
  private animate=()=>{
    this.frame=requestAnimationFrame(this.animate);
    this.controls.update();
    if(this.playing&&this.yarn){
      const part=Math.min(1,(performance.now()-this.start)/550);
      const index=this.yarn.geometry.getIndex();
      if(index){
        const fraction=this.startFraction+(1-this.startFraction)*part;
        this.yarn.geometry.setDrawRange(0,Math.floor(index.count*fraction/30)*30);
      }
      if(this.activeCurve){
        const position=this.activeCurve.getPointAt(Math.max(0,Math.min(1,this.startFraction+(1-this.startFraction)*part)));
        this.tool.position.copy(position);
        if(this.trailing){
          this.trailing.geometry.dispose();
          const loose=new THREE.CatmullRomCurve3([position,new THREE.Vector3(position.x+.4,position.y+.3,.35),new THREE.Vector3(3.5,-1,.3),new THREE.Vector3(4.2,-1.5,.3)]);
          this.trailing.geometry=new THREE.TubeGeometry(loose,50,.045,7);
        }
      }
      if(part>=1)this.playing=false;
    }else if(this.yarn) this.yarn.geometry.setDrawRange(0,Infinity);
    this.renderer.render(this.scene,this.camera);
  };
  destroy(){cancelAnimationFrame(this.frame);this.ro.disconnect();this.controls.dispose();this.renderer.dispose();}
}

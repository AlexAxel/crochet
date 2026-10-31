import {Application,Container,Graphics} from 'pixi.js';
import type {ChainFrame} from '../core/chainSession';

/**
 * New art-direction: hand-drawn 2.5D braided yarn in PixiJS.
 * No imports from the old Three.js / XPBD / stableChain render pipeline.
 *
 * Shape is transcribed from FRONT-of-chain photographs (two ridges,
 * short rear bump and overlapping V in every link) rather than a chain
 * diagram oval or the earlier 3D ring geometry.
 */
export const COLORS={
  blue:{base:0x89b9dc,deep:0x406c91,shade:0x5d91bb,light:0xd2efff},
  cream:{base:0xe9d6b4,deep:0x977e60,shade:0xc7ae89,light:0xfff7df},
  rose:{base:0xdba6b7,deep:0x916879,shade:0xc3889d,light:0xffe6eb},
  sage:{base:0xa9c1a9,deep:0x567e6a,shade:0x82a58f,light:0xedf7e2},
  lavender:{base:0xb6a7d0,deep:0x726488,shade:0x9989b5,light:0xf1e9ff},
} as const;
export type YarnColor=keyof typeof COLORS;
type Point={x:number;y:number};
type Curve=[number,number,number,number,number,number,number,number];
const ease=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)};
const between=(a:number,b:number,t:number)=>a+(b-a)*t;
const path=(x:number,y:number,cx1:number,cy1:number,cx2:number,cy2:number,ex:number,ey:number):Curve=>
  [x,y,cx1,cy1,cx2,cy2,ex,ey];
function trace(g:Graphics,c:Curve,dx=0,dy=0){
  g.moveTo(c[0]+dx,c[1]+dy);
  g.bezierCurveTo(c[2]+dx,c[3]+dy,c[4]+dx,c[5]+dy,c[6]+dx,c[7]+dy);
}
function cord(g:Graphics,c:Curve,color:typeof COLORS[YarnColor],width=14){
  // Matte cotton shading, without the bright plastic-looking pipe outline.
  trace(g,c,2,3);g.stroke({color:0x41352d,width:width+3,alpha:.17,cap:'round',join:'round'});
  trace(g,c);g.stroke({color:color.deep,width:width+1.5,alpha:.78,cap:'round',join:'round'});
  trace(g,c);g.stroke({color:color.shade,width,cap:'round',join:'round'});
  trace(g,c,-.65,-.85);g.stroke({color:color.base,width:width*.68,alpha:.92,cap:'round',join:'round'});
  trace(g,c,-1.5,-1.7);g.stroke({color:color.light,width:width*.12,alpha:.52,cap:'round',join:'round'});
  // Tiny oblique twist/fiber marks give the yarn a softer woven texture.
  for(let k=1;k<=5;k++){
    const t=k/6,u=1-t;
    const x=u*u*u*c[0]+3*u*u*t*c[2]+3*u*t*t*c[4]+t*t*t*c[6];
    const y=u*u*u*c[1]+3*u*u*t*c[3]+3*u*t*t*c[5]+t*t*t*c[7];
    const dx=3*u*u*(c[2]-c[0])+6*u*t*(c[4]-c[2])+3*t*t*(c[6]-c[4]);
    const dy=3*u*u*(c[3]-c[1])+6*u*t*(c[5]-c[3])+3*t*t*(c[7]-c[5]);
    const l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
    const h=width*.30;
    g.moveTo(x-nx*h-dx/l*1.5,y-ny*h-dy/l*1.5);
    g.lineTo(x+nx*h+dx/l*1.5,y+ny*h+dy/l*1.5);
    g.stroke({color:color.light,width:1.1,alpha:.34,cap:'round'});
  }
}
function st(g:Graphics,c:Curve,width:number,color:number,alpha=1){
  trace(g,c);g.stroke({color,width,alpha,cap:'round',join:'round'});
}
export class PixiTable{
  readonly canvas:HTMLCanvasElement;
  private app:Application;
  private world=new Container();
  private props=new Graphics();
  private rear=new Graphics();
  private faces=new Graphics();
  private fibers=new Graphics();
  private tool=new Graphics();
  private model:ChainFrame|null=null;
  private color:YarnColor='blue';
  private hookVisible=true;
  private showGuide=false;
  private isDragging=false;
  private pointer=-1;
  private last={x:0,y:0};
  private onResize:ResizeObserver;
  private zoom=1;
  private w=1;private h=1;
  private constructor(app:Application,private container:HTMLElement){
    this.app=app;this.canvas=app.canvas;
    this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab';
    container.append(this.canvas);
    app.stage.addChild(this.world);
    this.world.addChild(this.props,this.rear,this.faces,this.fibers,this.tool);
    this.w=container.clientWidth;this.h=container.clientHeight;
    this.resetView();this.drawProps();
    this.onResize=new ResizeObserver(()=>this.resize());
    this.onResize.observe(container);
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.canvas.addEventListener('pointerdown',e=>{
      this.isDragging=true;this.pointer=e.pointerId;
      this.last={x:e.clientX,y:e.clientY};
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor='grabbing';
    });
    this.canvas.addEventListener('pointermove',e=>{
      if(!this.isDragging||e.pointerId!==this.pointer)return;
      this.world.position.x+=e.clientX-this.last.x;
      this.world.position.y+=e.clientY-this.last.y;
      this.last={x:e.clientX,y:e.clientY};
    });
    const release=(e:PointerEvent)=>{
      if(e.pointerId!==this.pointer)return;
      this.isDragging=false;this.pointer=-1;this.canvas.style.cursor='grab';
    };
    this.canvas.addEventListener('pointerup',release);
    this.canvas.addEventListener('pointercancel',release);
    this.canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault()});
    this.canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      const rect=this.canvas.getBoundingClientRect();
      const px=e.clientX-rect.left,py=e.clientY-rect.top;
      const before={x:(px-this.world.x)/this.world.scale.x,y:(py-this.world.y)/this.world.scale.y};
      this.zoom=Math.min(5,Math.max(.55,this.zoom*Math.exp(-e.deltaY*.00125)));
      this.world.scale.set(this.zoom);
      this.world.position.set(px-before.x*this.zoom,py-before.y*this.zoom);
    },{passive:false});
  }
  static async create(container:HTMLElement){
    const app=new Application();
    await app.init({resizeTo:container,backgroundAlpha:0,antialias:true,
      preference:'webgl',resolution:Math.min(2,window.devicePixelRatio||1),
      autoDensity:true});
    return new PixiTable(app,container);
  }
  setColor(name:YarnColor){this.color=name;this.drawProps();this.redraw();}
  setHookVisible(value:boolean){this.hookVisible=value;this.redraw();}
  setGuide(value:boolean){this.showGuide=value;this.redraw();}
  resetView(){
    this.zoom=this.h<620?.80:1.25;
    this.world.scale.set(this.zoom);
    this.world.position.set(this.w*.43,this.h*.23);
  }
  private resize(){
    const before={x:(this.w*.5-this.world.x)/this.zoom,y:(this.h*.5-this.world.y)/this.zoom};
    this.w=Math.max(1,this.container.clientWidth);
    this.h=Math.max(1,this.container.clientHeight);
    this.world.position.set(this.w*.5-before.x*this.zoom,this.h*.5-before.y*this.zoom);
    this.drawProps();this.redraw();
  }
  draw(frame:ChainFrame){this.model=frame;this.redraw();}
  private drawProps(){
    const g=this.props;g.clear();
    // Illustrated desk clutter: muted paper, pencil and stitch-marker tray.
    g.roundRect(-530,-155,214,250,10).fill({color:0xf5e6d1,alpha:.88});
    g.roundRect(-526,-158,214,250,10).stroke({color:0xe1c3a8,width:2,alpha:.8});
    for(let k=0;k<9;k++)st(g,path(-514,-116+k*21,-456,-116+k*21,-390,-116+k*21,-337,-116+k*21),
      1,0xbba68f,.40);
    g.ellipse(-420,138,67,49).fill({color:0x8f7760,alpha:.27});
    g.ellipse(-423,134,66,47).fill({color:0xf1d9bd,alpha:.87});
    for(let i=0;i<4;i++){
      const x=-452+(i%2)*38,y=117+Math.floor(i/2)*32;
      g.circle(x,y,10).stroke({color:[0x8aa3b8,0xc9898b,0xa79f79,0xb197bc][i],width:4});
    }
    st(g,path(-470,-232,-420,-214,-351,-183,-276,-130),6,0x8d918c,.9);
    st(g,path(-465,-237,-415,-219,-346,-188,-271,-135),2,0xfaf5e9,.9);
    // Skein on the right. Actual strand entry terminates at its top-left edge.
    g.ellipse(424,194,94,68).fill({color:0x654d42,alpha:.28});
    const color=COLORS[this.color];
    g.ellipse(420,181,91,67).fill(color.deep);
    g.ellipse(413,176,86,64).fill(color.base);
    for(let i=-9;i<=9;i++){
      g.ellipse(415+i*1.5,178,Math.max(18,70-Math.abs(i)*3),58)
        .stroke({color:i%2?color.light:color.shade,width:1.6,alpha:.31});
    }
    g.roundRect(390,132,51,97,6).fill(0xf6e6ca);
    g.roundRect(395,174,42,11,3).fill(0xb89b83);
  }
  private drawChainLink(y:number,index:number,blend=1){
    const col=COLORS[this.color];
    const x=Math.sin(index*1.9)*1.35;
    const w=14.2*blend,h=7.1*blend;
    // Close-packed braided anatomy: raised rear bar tucked UNDER the
    // next face V. Avoid empty open droplet/ring silhouettes.
    cord(this.rear,path(x-11.5,y-12,x-3,y-22,x+7,y-20,x+12,y-9),col,11.3);
    // Slightly asymmetric, interlocking front legs. Wide stitches and big
    // triangular holes made the previous attempt look like a necklace.
    cord(this.faces,path(x-w,y-12,x-w-1,y-1,x-7*blend,y+4,x+.6,y+h),col,13.9);
    cord(this.faces,path(x+w,y-12,x+w-1,y-3,x+6*blend,y+8,x+.7,y+h),col,13.9);
    // Tiny silk-like twist lines at the crossing, not exaggerated rings.
    if(blend>.87){
      const dy=y+2;
      st(this.fibers,path(x-14,dy-3,x-10,dy-3,x-7,dy,x-4,dy+3),1.5,col.light,.6);
      st(this.fibers,path(x+14,dy-2,x+10,dy-1,x+7,dy+2,x+4,dy+4),1.4,col.light,.54);
    }
  }
  private drawSlipKnot(y:number){
    const col=COLORS[this.color];
    // A small tightened knot and tail, separate from numbered CH stitches.
    // The starting slip knot is TIGHT and small. It is not an eighth
    // decorated chain ring and should never resemble a figure-eight.
    cord(this.rear,path(-10,y-5,-18,y+5,-12,y+18,0,y+17),col,10.3);
    cord(this.faces,path(-10,y-7,2,y-15,14,y-1,4,y+9),col,11.5);
    cord(this.rear,path(4,y+9,-10,y+23,-42,y+53,-106,y+76),col,10.2);
  }
  private drawLive(frame:ChainFrame,shift:number){
    const col=COLORS[this.color];
    const p=frame.progress;
    // A single working loop held around the hook shaft; two visible
    // arms, curved crown. No extra closed rings at rest.
    const tighten=frame.drawing?ease((p-.70)/.30):0;
    const oldBottom=18+shift*.12;
    const constrict=1-.66*tighten;
    cord(this.rear,path(-14*constrict,oldBottom,
      -21*constrict,-4,-22*constrict,-42,-6,-47),col,11.9);
    cord(this.faces,path(-6,-47,14,-52,22*constrict,-24,
      14*constrict,oldBottom),col,11.9);
    if(frame.drawing&&p>=.18){
      const forming=ease((p-.34)/.55);
      const pulled=ease((p-.39)/.38);
      // Yarn over: captured material travels along the hook, and is
      // visibly drawn through the former working loop. The new
      // bight develops before the old loop seats as a chain link.
      const atY=between(-33,-71,pulled);
      cord(this.faces,path(62,-42,44,-57,9,-78,-3,atY),col,10.7);
      cord(this.faces,path(-3,atY,-12,atY-13,-18,atY-3,
        -13-6*forming,-23),col,11.1);
      if(!this.hookVisible){
        this.tool.circle(-3,atY,9).fill(0xdf344c).stroke({color:0xfff9e9,width:3});
        this.tool.circle(-3,atY,2.5).fill(0xffffff);
      }
    }
  }
  private drawWorkingYarn(){
    const col=COLORS[this.color];
    // Supply goes from ball, over the hook and into the active loop.
    cord(this.rear,path(346,158,281,112,208,47,115,-17),col,11);
    cord(this.faces,path(115,-17,71,-40,47,-53,21,-42),col,11.5);
  }
  private drawHook(p=0){
    const g=this.tool;
    if(!this.hookVisible)return;
    const offset=p<.18?11*(1-ease(p/.18)):-7*ease((p-.35)/.5);
    // Wrought aluminum throat + warm ergonomic wooden handle.
    st(g,path(-17+offset,-49,-34+offset,-51,-36+offset,-33,-21+offset,-33),11,0x707a7b);
    st(g,path(-17+offset,-50,-34+offset,-52,-36+offset,-34,-21+offset,-34),7.4,0xdee6e8);
    st(g,path(-21+offset,-34,6+offset,-40,72+offset,-31,135+offset,-23),10.6,0x858f91);
    st(g,path(-21+offset,-36,8+offset,-42,74+offset,-33,136+offset,-25),5.5,0xf3f6f0);
    st(g,path(66+offset,-33,104+offset,-28,177+offset,-8,218+offset,-1),17,0xa97758);
    st(g,path(66+offset,-36,104+offset,-31,177+offset,-11,218+offset,-4),3,0xd7ac87,.52);
    g.circle(218+offset,-1,8.3).fill(0xb68161);
  }
  private redraw(){
    if(!this.model)return;
    this.rear.clear();this.faces.clear();this.fibers.clear();this.tool.clear();
    const f=this.model;
    const p=f.progress;
    const move=f.drawing?ease((p-.65)/.35):0;
    // The *layout* reflows as a chain hangs down from the active hook.
    // Previously committed yarn geometry is invariant in shape and order.
    const offset=move*24;
    for(let i=0;i<f.completed;i++){
      const y=35+(f.completed-1-i)*24+offset;
      this.drawChainLink(y,i);
    }
    const showing=f.drawing?ease((p-.74)/.26):0;
    if(showing>0)this.drawChainLink(35,f.completed,Math.max(.12,showing));
    this.drawSlipKnot(35+f.completed*24+offset);
    this.drawWorkingYarn();
    this.drawLive(f,offset);
    this.drawHook(f.drawing?p:0);
    if(this.showGuide){
      this.tool.circle(0,-36,33).stroke({color:0xffe09d,width:2,alpha:.78});
    }
  }
  dispose(){this.onResize.disconnect();this.app.destroy(true,{children:true});}
}

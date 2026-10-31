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
  trace(g,c,2.5,4);g.stroke({color:0x41352d,width:width+4,alpha:.23,cap:'round',join:'round'});
  trace(g,c);g.stroke({color:color.deep,width:width+2,cap:'round',join:'round'});
  trace(g,c);g.stroke({color:color.shade,width,cap:'round',join:'round'});
  trace(g,c,-1,-1);g.stroke({color:color.base,width:width*.68,alpha:.95,cap:'round',join:'round'});
  trace(g,c,-2,-2.5);g.stroke({color:color.light,width:width*.17,alpha:.83,cap:'round',join:'round'});
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
    const x=Math.sin(index*1.8)*1.7;
    const w=17*blend,h=13*blend;
    // The rear bump is under both FRONT legs, as visible on the back of
    // an actual foundation chain. It is NOT a third disconnected V.
    cord(this.rear,path(x-12,y-14,x-4,y-26,x+8,y-26,x+14,y-13),col,10.2);
    // Overlapping front braid. Slight left/right asymmetry prevents a
    // synthetic row of perfectly duplicated triangles or teardrops.
    cord(this.faces,path(x-w,y-13,x-w+1,y-1,x-10*blend,y+6,x,y+h),col,13.3);
    cord(this.faces,path(x+w,y-13,x+w-2,y-3,x+9*blend,y+10,x+1,y+h),col,13.3);
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
    cord(this.rear,path(-11,y-2,-22,y+1,-22,y+16,-6,y+20),col,11);
    cord(this.rear,path(-6,y+20,8,y+24,-2,y+37,-9,y+42),col,11);
    cord(this.faces,path(-16,y-8,-6,y-18,16,y-8,14,y+6),col,12);
    cord(this.faces,path(14,y+6,9,y+19,-8,y+14,-9,y+24),col,12);
    cord(this.rear,path(-9,y+24,-29,y+44,-63,y+77,-111,y+101),col,10.6);
  }
  private drawLive(frame:ChainFrame,shift:number){
    const col=COLORS[this.color];
    const p=frame.progress;
    // A single working loop held around the hook shaft; two visible
    // arms, curved crown. No extra closed rings at rest.
    const tighten=frame.drawing?ease((p-.70)/.30):0;
    const oldBottom=26+shift*.22;
    const constrict=1-.64*tighten;
    cord(this.rear,path(-15*constrict,oldBottom,
      -27*constrict,2,-29*constrict,-54,-8,-58),col,12.4);
    cord(this.faces,path(-8,-58,16,-65,29*constrict,-30,
      16*constrict,oldBottom),col,12.4);
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
    const offset=p<.18?14*(1-ease(p/.18)):-10*ease((p-.35)/.5);
    // Wrought aluminum throat + warm ergonomic wooden handle.
    st(g,path(-17+offset,-60,-38+offset,-63,-41+offset,-42,-22+offset,-42),15,0x707a7b);
    st(g,path(-17+offset,-61,-38+offset,-64,-41+offset,-43,-22+offset,-43),11,0xdee6e8);
    st(g,path(-22+offset,-43,6+offset,-50,72+offset,-39,135+offset,-31),14,0x858f91);
    st(g,path(-22+offset,-45,8+offset,-52,74+offset,-41,136+offset,-33),8,0xf3f6f0);
    st(g,path(66+offset,-41,104+offset,-36,177+offset,-16,218+offset,-9),24,0xa97758);
    st(g,path(66+offset,-46,104+offset,-41,177+offset,-21,218+offset,-14),6,0xd7ac87,.63);
    g.circle(218+offset,-9,11).fill(0xb68161);
  }
  private redraw(){
    if(!this.model)return;
    this.rear.clear();this.faces.clear();this.fibers.clear();this.tool.clear();
    const f=this.model;
    const p=f.progress;
    const move=f.drawing?ease((p-.65)/.35):0;
    // The *layout* reflows as a chain hangs down from the active hook.
    // Previously committed yarn geometry is invariant in shape and order.
    const offset=move*32;
    for(let i=0;i<f.completed;i++){
      const y=43+(f.completed-1-i)*32+offset;
      this.drawChainLink(y,i);
    }
    const showing=f.drawing?ease((p-.74)/.26):0;
    if(showing>0)this.drawChainLink(43,f.completed,Math.max(.12,showing));
    this.drawSlipKnot(43+f.completed*32+offset);
    this.drawWorkingYarn();
    this.drawLive(f,offset);
    this.drawHook(f.drawing?p:0);
    if(this.showGuide){
      this.tool.circle(0,-36,33).stroke({color:0xffe09d,width:2,alpha:.78});
    }
  }
  dispose(){this.onResize.disconnect();this.app.destroy(true,{children:true});}
}

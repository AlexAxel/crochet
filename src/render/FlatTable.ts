import type {CrochetFrame,V3} from '../core/stableChain';

/**
 * Game-art 2.5D renderer on Canvas2D. No physical yarn state, no duplicated
 * gameplay rules: uses the same deterministic stitch paths as Three.js.
 * Zoom is centered on the cursor and middle-click pans the tabletop.
 */
type RGB={dark:string;base:string;light:string};
const PALETTE:Record<string,RGB>={
  blue:{dark:'#426e95',base:'#76b4e3',light:'#c9ecff'},
  cream:{dark:'#917458',base:'#ead4b2',light:'#fff6df'},
  rose:{dark:'#966377',base:'#d89caf',light:'#ffe4eb'},
  sage:{dark:'#586c60',base:'#9ebda5',light:'#e4f0d5'},
  lavender:{dark:'#736282',base:'#b8a9d0',light:'#efe3ff'}
};
type Screen={x:number;y:number};
const smoothLine=(ctx:CanvasRenderingContext2D,points:Screen[])=>{
  if(points.length<2)return;
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length-1;i++){
    ctx.quadraticCurveTo(points[i].x,points[i].y,(points[i].x+points[i+1].x)/2,(points[i].y+points[i+1].y)/2);
  }
  ctx.lineTo(points[points.length-1].x,points[points.length-1].y);
};
export class FlatTable{
  readonly canvas=document.createElement('canvas');
  private ctx=this.canvas.getContext('2d')!;
  private w=1;
  private h=1;
  private scale=90;
  private zoom=1;
  private pan={x:0,y:-.06};
  private dragged=false;
  private lastMouse={x:0,y:0};
  private pointerId:number|null=null;
  private lastFrame:CrochetFrame|null=null;
  private lastColor='blue';
  private hookVisible=true;
  private guide=false;
  private ro:ResizeObserver;
  constructor(private container:HTMLElement){
    this.canvas.className='flat-table-canvas';
    this.canvas.setAttribute('aria-label','Плоский игровой вид вязания 2,5D');
    this.canvas.style.display='none';
    this.canvas.style.position='absolute';
    this.canvas.style.inset='0';
    this.canvas.style.width='100%';
    this.canvas.style.height='100%';
    this.canvas.style.touchAction='none';
    container.append(this.canvas);
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.canvas.addEventListener('pointerdown',event=>{
      if(event.button!==1&&event.button!==2&&event.button!==0)return;
      this.dragged=true;this.pointerId=event.pointerId;
      this.lastMouse={x:event.clientX,y:event.clientY};
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!this.dragged||event.pointerId!==this.pointerId)return;
      const dx=event.clientX-this.lastMouse.x,dy=event.clientY-this.lastMouse.y;
      this.pan.x-=dx/this.scale;this.pan.y+=dy/this.scale;
      this.lastMouse={x:event.clientX,y:event.clientY};
      this.redraw();
    });
    const release=(event:PointerEvent)=>{
      if(event.pointerId===this.pointerId){this.dragged=false;this.pointerId=null;}
    };
    this.canvas.addEventListener('pointerup',release);
    this.canvas.addEventListener('pointercancel',release);
    this.canvas.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault()});
    this.canvas.addEventListener('wheel',event=>{
      event.preventDefault();
      const rect=this.canvas.getBoundingClientRect();
      const sx=event.clientX-rect.left,sy=event.clientY-rect.top;
      const before=this.fromScreen(sx,sy);
      const factor=Math.exp(-event.deltaY*.0014);
      this.zoom=Math.min(8,Math.max(.65,this.zoom*factor));
      this.updateScale();
      // Keep the exact point under the cursor during zoom.
      this.pan.x=before.x-(sx-this.w/2)/this.scale;
      this.pan.y=before.y+(sy-this.h/2)/this.scale;
      this.redraw();
    },{passive:false});
    this.ro=new ResizeObserver(()=>this.resize());
    this.ro.observe(container);
    this.resize();
  }
  show(visible:boolean){this.canvas.style.display=visible?'block':'none';if(visible)this.redraw();}
  setColor(name:string){this.lastColor=name;this.redraw();}
  setHookVisible(visible:boolean){this.hookVisible=visible;this.redraw();}
  setGuide(visible:boolean){this.guide=visible;this.redraw();}
  resetView(){this.pan={x:0,y:-.06};this.zoom=1;this.updateScale();this.redraw();}
  render(frame:CrochetFrame){this.lastFrame=frame;this.redraw();}
  private resize(){
    const dpr=Math.min(2,window.devicePixelRatio||1);
    this.w=Math.max(1,this.container.clientWidth);
    this.h=Math.max(1,this.container.clientHeight);
    this.canvas.width=Math.round(this.w*dpr);
    this.canvas.height=Math.round(this.h*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.updateScale();this.redraw();
  }
  private updateScale(){this.scale=(this.h/9.3)*this.zoom;}
  private at(v:V3):Screen{
    return {x:this.w/2+(v.x-this.pan.x)*this.scale,
      y:this.h/2-(v.y-this.pan.y+v.z*.13)*this.scale};
  }
  private fromScreen(x:number,y:number){
    return {x:(x-this.w/2)/this.scale+this.pan.x,
      y:(this.h/2-y)/this.scale+this.pan.y};
  }
  private ellipse(x:number,y:number,rx:number,ry:number,color:string,rotation=0){
    this.ctx.beginPath();this.ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);
    this.ctx.fillStyle=color;this.ctx.fill();
  }
  private decor(){
    const ctx=this.ctx,unit=this.scale;
    // Cast shadows, paper pattern, loose markers, two spare needles.
    const paper=this.at({x:-5.35,y:-1.65,z:0});
    ctx.save();ctx.translate(paper.x,paper.y);ctx.rotate(.21);
    ctx.shadowColor='#4d30284a';ctx.shadowBlur=16;ctx.shadowOffsetY=7;
    ctx.fillStyle='#f9edda';ctx.fillRect(-.9*unit,-1.1*unit,1.8*unit,2.3*unit);
    ctx.shadowColor='transparent';
    ctx.strokeStyle='#ddd0b8';ctx.lineWidth=1;
    for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(-.72*unit,(-.7+i*.18)*unit);ctx.lineTo(.72*unit,(-.7+i*.18)*unit);ctx.stroke()}
    ctx.restore();
    for(let k=0;k<2;k++){
      const from=this.at({x:-5.6,y:k?3.24:2.06,z:.05});
      const to=this.at({x:-3.40,y:k?2.1:3.23,z:.05});
      ctx.lineWidth=.065*unit;ctx.lineCap='round';ctx.strokeStyle='#a7aeb3';
      ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
      ctx.strokeStyle='#f2f8f6';ctx.lineWidth=.018*unit;ctx.stroke();
      this.ellipse(to.x,to.y,.095*unit,.095*unit,'#bd8568');
    }
    for(let i=0;i<4;i++){
      const item=this.at({x:-5.25+i*.33,y:-1.62+(i%2)*.28,z:.13});
      ctx.strokeStyle=['#d67a76','#9ba98b','#e4bf73','#a192bf'][i];
      ctx.lineWidth=3;ctx.beginPath();ctx.arc(item.x,item.y,8*this.zoom,0,Math.PI*2);ctx.stroke();
    }
  }
  private spool(){
    const ctx=this.ctx,ball=this.at({x:5.12,y:-2.06,z:.13}),r=this.scale;
    ctx.save();
    ctx.shadowColor='#4a2d2b65';ctx.shadowBlur=20;ctx.shadowOffsetY=10;
    this.ellipse(ball.x,ball.y,.80*r,.61*r,'#344f67');
    ctx.shadowColor='transparent';
    const color=PALETTE[this.lastColor]??PALETTE.blue;
    const grad=ctx.createRadialGradient(ball.x-.30*r,ball.y-.3*r,.09*r,ball.x,ball.y,.87*r);
    grad.addColorStop(0,color.light);grad.addColorStop(.45,color.base);grad.addColorStop(1,color.dark);
    this.ellipse(ball.x,ball.y,.78*r,.60*r,grad as unknown as string);
    ctx.save();ctx.beginPath();ctx.ellipse(ball.x,ball.y,.77*r,.59*r,0,0,Math.PI*2);ctx.clip();
    ctx.strokeStyle='#ffffff59';ctx.lineWidth=2;
    for(let i=-24;i<26;i++){
      ctx.beginPath();ctx.ellipse(ball.x,ball.y,.5*r+i*1.6,.53*r,Math.PI*.34,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
    ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(-.2);
    ctx.fillStyle='#f4e8cf';ctx.fillRect(-.18*r,-.44*r,.36*r,.89*r);
    ctx.fillStyle='#bc987d';ctx.fillRect(-.15*r,-.04*r,.30*r,.10*r);ctx.restore();
    ctx.restore();
  }
  private yarn(points:V3[]){
    if(points.length<2)return;
    const ctx=this.ctx;
    const color=PALETTE[this.lastColor]??PALETTE.blue;
    const screen=points.map(v=>this.at(v));
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.save();ctx.translate(3,5);ctx.strokeStyle='#573c3859';ctx.lineWidth=15*this.zoom;smoothLine(ctx,screen);ctx.stroke();ctx.restore();
    ctx.strokeStyle=color.dark;ctx.lineWidth=13*this.zoom;smoothLine(ctx,screen);ctx.stroke();
    ctx.strokeStyle=color.base;ctx.lineWidth=10*this.zoom;smoothLine(ctx,screen);ctx.stroke();
    ctx.strokeStyle=color.light;ctx.lineWidth=3*this.zoom;ctx.save();ctx.translate(-1.5,-2);smoothLine(ctx,screen);ctx.stroke();ctx.restore();
    // Small yarn glints follow arclength (not fixed screen-space sprites).
    ctx.strokeStyle='#ffffff40';ctx.lineWidth=1.1;
    for(let i=2;i<screen.length;i+=5){
      const a=screen[i-1],b=screen[i];
      const midX=(a.x+b.x)/2,midY=(a.y+b.y)/2;
      const d=Math.hypot(b.x-a.x,b.y-a.y)||1;
      ctx.beginPath();ctx.moveTo(midX+(b.y-a.y)/d*3,midY-(b.x-a.x)/d*3);
      ctx.lineTo(midX-(b.y-a.y)/d*3,midY+(b.x-a.x)/d*3);ctx.stroke();
    }
  }
  private hook(frame:CrochetFrame){
    const ctx=this.ctx;
    const at=this.at(frame.hook);
    const r=this.scale,scale=Math.max(.6,Math.min(2.1,this.zoom));
    ctx.save();ctx.translate(at.x,at.y);
    ctx.rotate(frame.phase==='pull-through'?.15:-.10);
    ctx.shadowColor='#4b3d3663';ctx.shadowBlur=10;ctx.shadowOffsetY=5;
    ctx.strokeStyle='#84969d';ctx.lineWidth=.065*r;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(-.17*r,-.05*r);
    ctx.quadraticCurveTo(-.3*r,-.18*r,-.26*r,.06*r);
    ctx.quadraticCurveTo(-.17*r,.17*r,0,0);
    ctx.lineTo(1.7*r,.55*r);ctx.stroke();
    ctx.shadowColor='transparent';
    ctx.strokeStyle='#f6faf8';ctx.lineWidth=.019*r;
    ctx.beginPath();ctx.moveTo(.22*r,.08*r);ctx.lineTo(1.65*r,.53*r);ctx.stroke();
    ctx.strokeStyle='#b98662';ctx.lineWidth=.115*r;
    ctx.beginPath();ctx.moveTo(.65*r,.22*r);ctx.lineTo(1.69*r,.55*r);ctx.stroke();
    ctx.restore();void scale;
  }
  private marker(point:V3){
    const at=this.at(point),r=11*Math.max(.7,Math.min(2.5,this.zoom)),ctx=this.ctx;
    ctx.save();ctx.shadowColor='#ea263d';ctx.shadowBlur=14;
    ctx.fillStyle='#ec1f3d';ctx.strokeStyle='#fffaf2';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(at.x,at.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(at.x,at.y,r*.28,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  private redraw(){
    if(this.canvas.style.display==='none')return;
    const ctx=this.ctx;ctx.clearRect(0,0,this.w,this.h);
    this.decor();this.spool();
    const frame=this.lastFrame;if(!frame)return;
    this.yarn(frame.points);
    if(this.guide){
      const at=this.at(frame.live[4]);
      ctx.strokeStyle='#f9e0ad';ctx.lineWidth=3;ctx.beginPath();
      ctx.arc(at.x,at.y,24*this.zoom,0,Math.PI*2);ctx.stroke();
    }
    if(this.hookVisible)this.hook(frame);
    else if(frame.grasp || frame.phase==='idle')this.marker(frame.grasp??frame.hook);
  }
  dispose(){this.ro.disconnect();this.canvas.remove();}
}

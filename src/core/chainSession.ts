/**
 * Independent semantic crochet CH timeline. Based on Craft Yarn Council /
 * Annie's / Vogue Knitting: slipknot first, yarn over and draw through
 * one existing live loop; new live loop remains, one chain link commits.
 *
 * No visual vertices or simulation of arbitrary rope geometry.
 * PixiJS is solely responsible for handcrafted yarn artwork.
 */
export type Stage='rest'|'approach'|'yarn-over'|'draw-through'|'seat';
export type ChainLink=Readonly<{kind:'ch';number:number;previous:number|null}>;
export type ChainFrame=Readonly<{
  completed:number;stitches:readonly ChainLink[];stage:Stage;progress:number;
  queued:number;activeLoops:1;drawing:boolean
}>;
export const LIMIT=20;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export class ChainSession{
  private history:ChainLink[]=[];
  private progressValue:number|null=null;
  private requested=0;
  private duration=1550;
  get count(){return this.history.length;}
  get busy(){return this.progressValue!==null;}
  get capacity(){return LIMIT;}
  get queued(){return this.requested;}
  get frame():ChainFrame{
    const progress=this.progressValue??0;
    const stage:Stage=!this.busy?'rest':progress<.18?'approach':progress<.38?'yarn-over':progress<.79?'draw-through':'seat';
    return {completed:this.count,stitches:this.history,stage,progress,queued:this.requested,activeLoops:1,drawing:this.busy};
  }
  setSpeed(ms:number){this.duration=Math.max(650,Math.min(4000,ms));}
  press():boolean{
    if(this.count+this.requested+(this.busy?1:0)>=LIMIT)return false;
    if(this.busy){this.requested++;return true;}
    this.progressValue=0;return true;
  }
  advance(elapsedMs:number):number{
    let remain=Math.max(0,Math.min(elapsedMs,8000)),commits=0;
    while(this.busy&&remain>0){
      const gap=(1-this.progressValue!)*this.duration;
      if(remain+1e-8<gap){
        this.progressValue=clamp(this.progressValue!+remain/this.duration);remain=0;
      }else{
        remain-=gap;
        this.history.push(Object.freeze({kind:'ch' as const,number:this.history.length+1,previous:this.history.length||null}));
        commits++;
        if(this.requested>0){this.requested--;this.progressValue=0;}
        else this.progressValue=null;
      }
    }
    return commits;
  }
  undo():boolean{
    if(this.busy){this.progressValue=null;this.requested=0;return true;}
    this.requested=0;return this.history.pop()!==undefined;
  }
  reset(){this.requested=0;this.progressValue=null;this.history=[];}
}

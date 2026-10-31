import './style.css';
import {ChainSession} from './core/chainSession';
import {PixiTable,COLORS,type YarnColor} from './render/PixiTable';

const el=(id:string)=>document.getElementById(id)!;
const button=(id:string)=>el(id) as HTMLButtonElement;
const check=(id:string)=>el(id) as HTMLInputElement;

const machine=new ChainSession();
const add=button('add'),undo=button('undo'),reset=button('reset');
let canvas:PixiTable;
let toastTimer=0;
let audio:AudioContext|null=null;
function notice(message:string){
  el('notice').textContent=message;
  el('notice').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer=window.setTimeout(()=>el('notice').classList.remove('visible'),2000);
}
function note(){
  if(!check('sound').checked)return;
  try{
    audio??=new AudioContext();
    if(audio.state==='suspended')void audio.resume();
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    const t=audio.currentTime;
    oscillator.frequency.setValueAtTime(360,t);
    oscillator.frequency.exponentialRampToValueAtTime(230,t+.12);
    gain.gain.setValueAtTime(.018,t);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(t);oscillator.stop(t+.17);
  }catch{/* Audio never affects stitches. */}
}
function sync(){
  add.disabled=machine.count+machine.queued+(machine.busy?1:0)>=machine.capacity;
  undo.disabled=!machine.count&&!machine.busy;
  reset.disabled=!machine.count&&!machine.busy;
}
function stitch(){
  if(!machine.press())notice('Цепочка закончена — можно начать новую');
  sync();canvas.draw(machine.frame);
}
function unravel(){
  if(!machine.undo())notice('Пока нечего распускать');
  else canvas.draw(machine.frame);
  sync();
}
function startOver(){machine.reset();canvas.draw(machine.frame);sync();}
function settings(open:boolean){
  el('settings').hidden=!open;
  (open?button('settings-close'):button('settings-open')).focus();
}
async function boot(){
  canvas=await PixiTable.create(el('desk'));
  canvas.draw(machine.frame);
  sync();
  add.addEventListener('click',stitch);
  undo.addEventListener('click',unravel);
  reset.addEventListener('click',startOver);
  button('settings-open').addEventListener('click',()=>settings(true));
  button('settings-close').addEventListener('click',()=>settings(false));
  el('settings').addEventListener('click',e=>{if(e.target===el('settings'))settings(false);});
  button('reset-view').addEventListener('click',()=>canvas.resetView());
  check('speed').addEventListener('input',()=>machine.setSpeed(Number(check('speed').value)));
  check('show-hook').addEventListener('change',()=>canvas.setHookVisible(check('show-hook').checked));
  check('guide').addEventListener('change',()=>canvas.setGuide(check('guide').checked));
  document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(b=>{
    b.addEventListener('click',()=>{
      const color=b.dataset.color as YarnColor;
      if(!(color in COLORS))return;
      canvas.setColor(color);
      document.querySelectorAll('[data-color]').forEach(x=>x.classList.remove('chosen'));
      b.classList.add('chosen');
    });
  });
  window.addEventListener('keydown',e=>{
    const open=!el('settings').hidden;
    if(e.key==='Escape'&&open){e.preventDefault();settings(false);return;}
    if(open||e.target instanceof HTMLInputElement)return;
    if(e.key==='1'||e.code==='Numpad1'){e.preventDefault();stitch();}
    else if(e.key==='2'||e.key==='Backspace'){e.preventDefault();unravel();}
    else if(e.key==='r'||e.key==='R'){e.preventDefault();startOver();}
    else if(e.code==='Space'){e.preventDefault();notice('Следующий ряд — после проверки воздушной петли');}
  });
  let last=performance.now();
  function tick(now:number){
    const elapsed=Math.min(100,Math.max(0,now-last));last=now;
    if(machine.busy){
      const commits=machine.advance(elapsed);
      canvas.draw(machine.frame);
      if(commits){sync();note();}
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
void boot().catch(error=>{
  console.error('Cannot initialize Pixi crochet studio',error);
  notice('Ошибка загрузки графики. Обнови страницу.');
});

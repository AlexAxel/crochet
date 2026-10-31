import './style.css';
import {ChainTable,COLORWAYS} from './render/ChainTable';
const el=(id:string)=>document.getElementById(id)!;
const text=(id:string,v:string)=>{el(id).textContent=v;};
const input=(id:string)=>el(id) as HTMLInputElement;
const button=(id:string)=>el(id) as HTMLButtonElement;
const table=new ChainTable(el('table'));
let toastTimeout=0;
let audio:AudioContext|null=null;
function note(message:string){
  text('notice',message);
  el('notice').classList.add('show');
  window.clearTimeout(toastTimeout);
  toastTimeout=window.setTimeout(()=>el('notice').classList.remove('show'),2400);
}
function sound(){
  if(!input('sound').checked)return;
  try{
    audio??=new AudioContext();
    if(audio.state==='suspended')void audio.resume();
    const now=audio.currentTime;
    const osc=audio.createOscillator(),gain=audio.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(410,now);
    osc.frequency.exponentialRampToValueAtTime(240,now+.09);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(.035,now+.016);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.14);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);osc.stop(now+.15);
  }catch{/* Sound is optional and must not affect crochet. */}
}
function sync(count:number,busy:boolean){
  button('stitch').disabled=busy||count>=table.capacity;
  button('unravel').disabled=count===0&&!busy;
  button('reset').disabled=count===0&&!busy;
}
table.onChange=sync;
table.onComplete=()=>sound();
function stitch(){
  if(!table.start()&&!table.busy)note('Цепочка готова. Для нового образца нажми ⟲');
}
function unravel(){
  if(table.unravel()){sound();}else note('Пока нечего распускать');
}
function reset(){table.reset();}
function settings(open:boolean){
  el('settings').hidden=!open;
  if(open)button('settings-close').focus();
  else button('settings-open').focus();
}
button('stitch').addEventListener('click',stitch);
button('unravel').addEventListener('click',unravel);
button('reset').addEventListener('click',reset);
button('settings-open').addEventListener('click',()=>settings(true));
button('settings-close').addEventListener('click',()=>settings(false));
el('settings').addEventListener('click',e=>{if(e.target===el('settings'))settings(false);});
el('reset-view').addEventListener('click',()=>table.resetView());
input('speed').addEventListener('input',()=>table.setSpeed(Number(input('speed').value)));
input('guide').addEventListener('change',()=>table.setGuide(input('guide').checked));
document.querySelectorAll<HTMLButtonElement>('[data-yarn]').forEach(b=>{
  b.addEventListener('click',()=>{
    const value=b.dataset.yarn!;
    if(!(value in COLORWAYS))return;
    table.setColor(value);
    document.querySelectorAll('[data-yarn]').forEach(x=>x.classList.remove('chosen'));
    b.classList.add('chosen');
  });
});
window.addEventListener('keydown',e=>{
  const overlay=!el('settings').hidden;
  if(e.key==='Escape'&&overlay){e.preventDefault();settings(false);return;}
  if(overlay||e.target instanceof HTMLInputElement)return;
  if(e.key==='1'||e.code==='Numpad1'){e.preventDefault();stitch();}
  else if(e.key==='2'||e.key==='Backspace'){e.preventDefault();unravel();}
  else if(e.key==='r'||e.key==='R'){e.preventDefault();reset();}
  else if(e.code==='Space'){e.preventDefault();note('Следующий ряд появится после проверки воздушной петли');}
});
sync(table.count,false);

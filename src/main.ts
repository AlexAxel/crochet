import './style.css';
import { apply, makeDemo, replay, validateGraph, type Command } from './core/model';
import { buildThread, validateLocalPassages } from './core/geometry';
import { YarnScene } from './render/YarnScene';

const el=(id:string)=>document.getElementById(id)!;
let actions:Command[]=makeDemo();
let pointer=actions.length;
let model=replay(actions);
const view=new YarnScene(el('scene'));
view.setModel(model,false);

function notify(s:string){
  const node=el('toast');node.textContent=s;node.classList.add('active');
  window.setTimeout(()=>node.classList.remove('active'),2800);
}
function render(hint=''){
  model=replay(actions.slice(0,pointer));
  view.setModel(model);
  const all=model.rows.flat();
  el('stat-row').textContent=String(model.rows.length-1);
  el('stat-loops').textContent=String(all.length);
  el('stat-left').textContent=String(model.rows.length>1?Math.max(0,model.cursor+1):0);
  el('stat-skip').textContent=String(model.skipped.length);
  const problems=validateGraph(model);
  const geo=buildThread(model);
  const geometryIssues=validateLocalPassages(geo);
  el('valid').textContent=problems.length||geometryIssues.length?'Есть ошибки':'Локальные проходы OK';
  el('valid').classList.toggle('invalid',problems.length+geometryIssues.length>0);
  const last=all[all.length-1];
  const next=model.rows.length>1 && model.cursor>=0
    ? model.rows[model.rows.length-2][model.cursor] : undefined;
  el('details').textContent=
    'Непрерывная нить: '+geo.segments.length+' петель; локальных проходов через основание: '+geo.passages.length+'. '+
    (last?'Последняя '+last.id+' · '+last.kind+' · основание: '+(last.parents.join(', ')||'начальная петля')+'. ':'Начало цепочки. ')+
    (next?'Следующая петля основания '+next.id+'.':'Оснований на текущий ряд не осталось.');
  el('hint').textContent=hint||(model.rows.length===1?'Создай цепочку и нажми Enter':model.cursor<0?'Ряд готов — нажми Enter':'1 — СБН · 2 — прибавка · 3 — убавка');
  (el('undo') as HTMLButtonElement).disabled=pointer===0;
  (el('redo') as HTMLButtonElement).disabled=pointer===actions.length;
  document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(b=>{
    const op=b.dataset.command as Command;
    b.disabled=op==='chain'?model.rows.length>1
      :op==='turn'?model.rows.at(-1)!.length===0||(model.rows.length>1&&model.cursor>=0)
      :model.rows.length===1||model.cursor<0||(op==='dec'&&model.cursor<1);
  });
}
function act(op:Command){
  const result=apply(model,op);
  if(result.error){notify(result.error);return;}
  actions=actions.slice(0,pointer);actions.push(op);pointer=actions.length;
  render('Выполнено: '+({chain:'воздушная петля',sc:'столбик без накида',inc:'прибавка',dec:'убавка',skip:'пропуск основания',turn:'поворот ряда'}[op]));
}
function undo(){if(pointer>0){pointer--;render('Последняя операция распущена');}}
function redo(){if(pointer<actions.length){pointer++;render('Операция восстановлена');}}
document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(b=>{
  b.addEventListener('click',()=>act(b.dataset.command as Command));
});
el('undo').addEventListener('click',undo);
el('redo').addEventListener('click',redo);
el('demo').addEventListener('click',()=>{actions=makeDemo();pointer=actions.length;render('Продолжай вязать образец');});
el('clear').addEventListener('click',()=>{actions=[];pointer=0;render('Пробел — первая воздушная петля');});
el('reset-view').addEventListener('click',()=>view.resetCamera());
el('debug').addEventListener('change',e=>view.showDebug((e.target as HTMLInputElement).checked));
document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(b=>{
  b.addEventListener('click',()=>{
    view.setColor(b.dataset.color!);
    document.querySelectorAll('[data-color]').forEach(c=>c.classList.remove('chosen'));
    b.classList.add('chosen');
  });
});
el('copy').addEventListener('click',async()=>{
  const data=JSON.stringify({format:'crochet-lab-alpha/1',commands:actions.slice(0,pointer),rows:model.rows,skipped:model.skipped},null,2);
  try{await navigator.clipboard.writeText(data);notify('История и граф скопированы');}
  catch{notify('Копирование доступно через HTTPS или localhost');}
});
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
  if(e.key==='Backspace'){e.preventDefault();undo();return;}
  const keyboard:Record<string,Command>={' ':'chain','1':'sc','2':'inc','3':'dec','4':'skip','Enter':'turn'};
  if(keyboard[e.key]){e.preventDefault();act(keyboard[e.key]);}
});
render('Готовое полотно: продолжай третий ряд, нажимая 1, 2 или 3');

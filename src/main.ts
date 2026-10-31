import './style.css';
import { apply, makeDemo, replay, validateGraph, type Command } from './core/model';
import { buildThread, validateLocalPassages } from './core/geometry';
import { lessonFor, studyDiagram } from './learn/lesson';
import { YarnScene } from './render/YarnScene';

const el=(id:string)=>document.getElementById(id)!;
const input=(id:string)=>el(id) as HTMLInputElement;
let actions:Command[]=makeDemo();
let pointer=actions.length;
let model=replay(actions);
let lesson:{op:Command;index:number}|null=null;
const view=new YarnScene(el('scene'));
view.setSpeed(2100);
view.setModel(model,false);

let toastTimer=0;
function notify(s:string){
  const node=el('toast');node.textContent=s;node.classList.add('active');
  window.clearTimeout(toastTimer);
  toastTimer=window.setTimeout(()=>node.classList.remove('active'),3600);
}
function setLessonPanel(){
  const fallback=lessonFor('chain',model);
  const current=lesson?lessonFor(lesson.op,model):fallback;
  const index=lesson?.index??0;
  const step=current.steps[index];
  el('lesson-title').textContent=lesson?current.name:'Как рождается петля';
  el('lesson-purpose').textContent=lesson?current.purpose:'Разбор можно запустить отдельно от игры. Каждая фаза показывает, что удерживается на крючке и через что идёт рабочая нить.';
  el('lesson-count').textContent=lesson?(index+1)+' / '+current.steps.length:'—';
  el('lesson-diagram').innerHTML=studyDiagram(lesson?.op??'chain',step,index,current.steps.length,model.rows[0].length);
  el('lesson-step-title').textContent=lesson?step.title:'Начни с воздушной петли';
  el('lesson-step-description').textContent=lesson?step.detail:'Нажми «1. Как делается ВП?» — откроется разбор реальных действий. В режиме обучения новая петля записывается в полотно только после последнего этапа.';
  (el('lesson-prev') as HTMLButtonElement).disabled=!lesson||index===0;
  (el('lesson-next') as HTMLButtonElement).textContent=!lesson?'Начать урок':index===current.steps.length-1?'Завершить и связать ✓':'Следующее движение →';
  (el('lesson-cancel') as HTMLButtonElement).disabled=!lesson;
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
  el('valid').textContent=problems.length||geometryIssues.length?'Ошибка локальной проверки':'Локальные проходы OK';
  el('valid').classList.toggle('invalid',problems.length+geometryIssues.length>0);
  const last=all.at(-1);
  const next=model.rows.length>1&&model.cursor>=0?model.rows[model.rows.length-2][model.cursor]:undefined;
  el('details').textContent=
    'Нить: '+geo.segments.length+' звеньев (включая '+model.turningChains.length+' петель подъёма). '+
    (last?'Последняя '+last.id+' ('+last.kind+'), основание: '+(last.parents.join(', ')||'скользящий узел')+'. ':'Начальная рабочая петля. ')+
    (next?'Следующее основание: '+next.id+'.':'Нет доступного основания в текущем ряду.');
  el('hint').textContent=hint||(model.rows.length===1
    ?'ВП (Пробел), затем Enter. Первый СБН — во вторую петлю от крючка.'
    :model.cursor<0?'Ряд готов — нажми Enter'
    :'Вяжи 1 — СБН, 2 — прибавка или 3 — убавка.');
  (el('undo') as HTMLButtonElement).disabled=pointer===0;
  (el('redo') as HTMLButtonElement).disabled=pointer===actions.length;
  document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(b=>{
    const op=b.dataset.command as Command;
    b.disabled=lesson!==null || (op==='chain'?model.rows.length>1
      :op==='turn'?model.rows.at(-1)!.length===0||(model.rows.length>1&&model.cursor>=0)
      :model.rows.length===1||model.cursor<0||(op==='dec'&&model.cursor<1));
  });
  setLessonPanel();
}
function commit(op:Command){
  const result=apply(model,op);
  if(result.error){notify(result.error);return;}
  actions=actions.slice(0,pointer);actions.push(op);pointer=actions.length;
  render('Связано: '+({
    chain:'воздушная петля',sc:'столбик без накида',inc:'два СБН в одно основание',
    dec:'СБН2вместе',skip:'основание пропущено',turn:'работа повернута'
  }[op]));
}
function startLesson(op:Command){
  const trial=apply(model,op);
  if(trial.error){notify(trial.error);return;}
  lesson={op,index:0};
  renderLessonOnly();
  view.focusCurrent();
}
function renderLessonOnly(){
  setLessonPanel();
  document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(b=>b.disabled=lesson!==null);
}
function perform(op:Command){
  if(lesson){notify('Сначала закончи текущий учебный разбор или нажми ×');return;}
  if(input('study-mode').checked)startLesson(op);
  else commit(op);
}
function finishLessonStep(){
  if(!lesson){
    startChainLesson();return;
  }
  const current=lessonFor(lesson.op,model);
  if(lesson.index<current.steps.length-1){
    lesson.index++;renderLessonOnly();return;
  }
  const completed=lesson.op;
  lesson=null;
  commit(completed);
}
function backLessonStep(){if(lesson&&lesson.index>0){lesson.index--;renderLessonOnly();}}
function cancelLesson(){if(!lesson)return;lesson=null;render('Учебный разбор отменён — полотно не изменилось');}
function startChainLesson(){
  lesson=null;actions=[];pointer=0;render('Урок ВП: начальный узел и одна активная петля на крючке.');
  startLesson('chain');
}
function startScLesson(){
  lesson=null;actions=[...Array(8).fill('chain') as Command[],'turn'];
  pointer=actions.length;render('Урок СБН: первая петля цепочки от крючка пропускается.');
  startLesson('sc');
}
function undo(){
  if(lesson){cancelLesson();return;}
  if(pointer>0){pointer--;render('Последняя операция распущена');}
}
function redo(){
  if(lesson){notify('Заверши или отменяй текущую демонстрацию');return;}
  if(pointer<actions.length){pointer++;render('Операция восстановлена');}
}
document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach(b=>{
  b.addEventListener('click',()=>perform(b.dataset.command as Command));
});
el('undo').addEventListener('click',undo);
el('redo').addEventListener('click',redo);
el('demo').addEventListener('click',()=>{lesson=null;actions=makeDemo();pointer=actions.length;render('Готовый образец: продолжай вязать третий ряд');view.resetCamera();});
el('clear').addEventListener('click',()=>{lesson=null;actions=[];pointer=0;render('Начальный скользящий узел уже на крючке. Нажми Пробел.');view.resetCamera();});
el('reset-view').addEventListener('click',()=>view.resetCamera());
el('focus').addEventListener('click',()=>view.focusCurrent());
el('debug').addEventListener('change',e=>view.showDebug((e.target as HTMLInputElement).checked));
el('lesson-prev').addEventListener('click',backLessonStep);
el('lesson-next').addEventListener('click',finishLessonStep);
el('lesson-cancel').addEventListener('click',cancelLesson);
el('lesson-start-chain').addEventListener('click',startChainLesson);
el('lesson-start-sc').addEventListener('click',startScLesson);
el('study-mode').addEventListener('change',()=>{
  if(!input('study-mode').checked && lesson)cancelLesson();
});
el('speed').addEventListener('input',()=>{
  const v=Number(input('speed').value);view.setSpeed(v);
  el('speed-value').textContent=v<1100?'Быстро':v<1900?'Умеренно':'Медленно';
});
document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(b=>{
  b.addEventListener('click',()=>{
    view.setColor(b.dataset.color!);
    document.querySelectorAll('[data-color]').forEach(c=>c.classList.remove('chosen'));
    b.classList.add('chosen');
  });
});
el('copy').addEventListener('click',async()=>{
  const data=JSON.stringify({format:'crochet-lab-alpha/2',commands:actions.slice(0,pointer),
    rows:model.rows,turningChains:model.turningChains,skipped:model.skipped},null,2);
  try{await navigator.clipboard.writeText(data);notify('История вязания и граф скопированы');}
  catch{notify('Скопировать можно на localhost или HTTPS');}
});
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
  if(e.key==='Escape'&&lesson){e.preventDefault();cancelLesson();return;}
  if(lesson && (e.key===' '||e.key==='Enter'||e.key==='ArrowRight')){
    e.preventDefault();finishLessonStep();return;
  }
  if(lesson && e.key==='ArrowLeft'){e.preventDefault();backLessonStep();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
  if(e.key==='Backspace'){e.preventDefault();undo();return;}
  const keyboard:Record<string,Command>={' ':'chain','1':'sc','2':'inc','3':'dec','4':'skip','Enter':'turn'};
  if(keyboard[e.key]){e.preventDefault();perform(keyboard[e.key]);}
});
render('Попробуй «1. Как делается ВП?» для поэтапного начала или продолжай образец');

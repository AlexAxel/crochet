
import type { Command, Model } from '../core/model';

export type LessonStep = { title:string; detail:string; hooks:number; phase:'start'|'insert'|'over'|'pull'|'finish'; };
export type Lesson = { name:string; purpose:string; steps:LessonStep[]; reference:string; };
const step=(title:string,detail:string,hooks:number,phase:LessonStep['phase']):LessonStep=>({title,detail,hooks,phase});

export function lessonFor(op:Command, model:Model):Lesson {
  if(op==='chain')return{
    name:'Воздушная петля',purpose:'Одна новая ВП из одной активной петли — не две петли на крючке.',
    reference:'Craft Yarn Council — Chain Stitch',
    steps:[
      step('Петля на крючке','Перед операцией на крючке уже одна рабочая петля. Начальный скользящий узел не считается воздушной петлёй.',1,'start'),
      step('Захват рабочей нити','Проведи рабочую нить за крючком и сверху вперёд. Крючок захватывает её бородкой.',1,'over'),
      step('Протягивание','Протяни захваченную нить через единственную старую петлю на крючке. Именно здесь появляется новое звено цепочки.',1,'pull'),
      step('Одна новая ВП готова','Старая петля теперь часть цепочки; на крючке остаётся ровно одна НОВАЯ активная петля. Она не прибавляется к счётчику готовых ВП.',1,'finish')
    ]
  };
  const foundation=model.rows.length===2 && model.rows[1].length===0;
  const into=foundation
    ? 'Введи крючок во вторую воздушную петлю от крючка. Первую оставляем для высоты первого ряда.'
    : 'Введи крючок под две верхние дужки V выбранной петли предыдущего ряда.';
  const sc=[
    step('Ввести крючок',into,1,'insert'),
    step('Захватить нить','С рабочей нити сделай накид на крючок.',1,'over'),
    step('Вытянуть новую петлю','Протяни захваченную нить через петлю ОСНОВАНИЯ. Теперь на крючке две рабочие петли.',2,'pull'),
    step('Ещё один накид','Захвати рабочую нить ещё раз. Оба ранее вытянутых витка остаются на крючке.',2,'over'),
    step('Через обе петли','Протяни новую нить через ОБЕ петли на крючке. Останется одна активная петля; СБН готов.',1,'finish')
  ];
  if(op==='sc')return{
    name:'Столбик без накида', purpose:'Одна петля основания → один столбик. На крючке последовательно 1 → 2 → 1 петля.',
    reference:'Crochet.com — Single Crochet',steps:sc
  };
  if(op==='inc')return{
    name:'Прибавка: 2 СБН в одну петлю',
    purpose:'Оба столбика вводятся в ОДНО основание. После первого СБН курсор не должен переходить к следующему.',
    reference:'Эксперт должен подтвердить способ ввода и положение двух столбиков.',
    steps:[
      ...sc.map(x=>({...x,title:'Первый СБН · '+x.title})),
      ...sc.map(x=>({...x,title:'Второй СБН · '+x.title,detail:x.phase==='insert'?'Верни крючок в ТУ ЖЕ петлю основания, где только что выполнен первый СБН.':x.detail}))
    ]
  };
  if(op==='dec')return{
    name:'Убавка СБН2вместе',purpose:'Два отдельных основания → один общий выходной столбик.',
    reference:'Нужна сверка конкретного варианта SC2TOG с экспертом.',
    steps:[
      step('Ввести в первое основание','Выбери первую из двух соседних петель, введи крючок.',1,'insert'),
      step('Накид и вытянуть','Захвати нить и вытяни петлю. На крючке две петли.',2,'pull'),
      step('Ввести во второе основание','Оставив две петли на крючке, введи его в соседнюю петлю основания.',2,'insert'),
      step('Накид и вытянуть','Вытяни петлю из второго основания. На крючке три петли.',3,'pull'),
      step('Протянуть через три','Сделай накид и протяни рабочую нить через все три петли. На крючке одна петля, два основания связаны вместе.',1,'finish')
    ]
  };
  if(op==='turn')return{
    name:'Повернуть работу',purpose:'Смена направления обработки петелек. Для последующих рядов добавляется воздушная петля подъёма.',
    reference:'Craft Yarn Council — Single Crochet',
    steps:[
      step('Завершённый ряд','Проверь, все ли петли основания провязаны. Пропуск можно оставить намеренно, но он влияет на рисунок.',1,'start'),
      step('Петля подъёма','Перед следующим рядом СБН обычно выполняют одну ВП подъёма; для самого первого ряда используется крайняя петля начальной цепочки.',1,'over'),
      step('Развернуть изделие','Поверни полотно, оставив активную петлю на крючке. Новый ряд пойдёт в обратном направлении.',1,'finish')
    ]
  };
  return {
    name:'Пропуск основания',
    purpose:'Пропуск без формирования нового столбика меняет число петель в ряду и может быть ошибкой или частью схемы.',
    reference:'Проверяйте по выбранной схеме, допускается ли пропуск.',
    steps:[
      step('Выбранная петля основания','Посмотри в режиме графа, какая именно петля будет пропущена.',1,'start'),
      step('Перейти дальше','Пропускаем основание, не создавая новую петлю нити. Следующий столбик пойдёт в следующее основание.',1,'finish')
    ]
  };
}

/** This is an educational schematic, NOT the physical stitch geometry. */
export function studyDiagram(op:Command, stage:LessonStep, stepIndex:number, total:number, existingCount:number):string{
  const c='#c18d75',light='#efc9a5',stroke='#6e6259',accent='#83aa9e';
  const showGrab=stage.phase==='over'||stage.phase==='pull'||stage.phase==='finish';
  const showThrough=stage.phase==='pull'||stage.phase==='finish';
  const liveX=showThrough?342:305;
  const finish=stage.phase==='finish';
  const isChain=op==='chain';
  const isInsert=stage.phase==='insert';
  let previous='';
  for(let i=0;i<Math.min(5,existingCount);i++){
    const x=90+i*32;
    previous+=\`<path d="M \${x} 145 Q \${x+13} 102 \${x+27} 145 Q \${x+14} 168 \${x} 145" fill="none" stroke="\${c}" stroke-width="10" stroke-linecap="round"/>\`;
  }
  const parent=!isChain?\`
    <path d="M 140 150 Q 205 96 262 150 Q 205 184 140 150" fill="none" stroke="\${c}" stroke-width="12" stroke-linecap="round"/>
    <path d="M 138 150 Q 205 91 264 150" fill="none" stroke="\${light}" stroke-width="3" opacity=".9"/>\`:'';
  const inserted=isInsert?'<path d="M 250 164 L 398 128" stroke="#a6b2b7" stroke-width="15" stroke-linecap="round"/>':'';
  return \`
    <svg viewBox="0 0 520 246" role="img" aria-label="Учебная схема движения нити: \${stage.title}" xmlns="http://www.w3.org/2000/svg">
      <defs><marker id="lessonArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#8f7c6c"/></marker></defs>
      <rect x="0" y="0" width="520" height="246" rx="15" fill="#f5ede2"/>
      <path d="M 12 200 Q 200 214 500 199" fill="none" stroke="#ddcdbb" stroke-width="1" stroke-dasharray="4 7"/>
      \${previous}
      \${parent}
      \${inserted}
      <path d="M 488 215 C 482 172 458 148 \${showGrab?380:413} 120" fill="none" stroke="\${c}" stroke-width="13" stroke-linecap="round"/>
      <path d="M 488 215 C 482 172 458 148 \${showGrab?380:413} 120" fill="none" stroke="\${light}" stroke-width="3" opacity=".85"/>
      \${showGrab?\`<path d="M 377 119 Q 340 74 \${liveX+3} 100" fill="none" stroke="\${accent}" stroke-width="12" stroke-linecap="round"/>\`:''}
      <ellipse cx="\${liveX}" cy="\${showThrough?99:115}" rx="23" ry="33" fill="none" stroke="\${finish?accent:c}" stroke-width="11"/>
      \${stage.hooks>=2?\`<ellipse cx="\${liveX-54}" cy="115" rx="20" ry="30" fill="none" stroke="\${c}" stroke-width="10"/>\`:''}
      \${stage.hooks>=3?\`<ellipse cx="\${liveX-97}" cy="115" rx="19" ry="29" fill="none" stroke="\${c}" stroke-width="10"/>\`:''}
      <path d="M 260 116 L 479 116" stroke="#708c90" stroke-width="15" stroke-linecap="round"/>
      <path d="M 260 109 L 479 109" stroke="#e0e8e4" stroke-width="3" stroke-linecap="round"/>
      <path d="M 259 116 Q 238 119 247 137 Q 270 144 274 122" stroke="#708c90" stroke-width="12" fill="none" stroke-linecap="round"/>
      \${showThrough?\`<path d="M 350 76 C 328 78 302 92 286 110" fill="none" stroke="#718d82" stroke-width="3" stroke-dasharray="6 4" marker-end="url(#lessonArrow)"/>\`:''}
      <circle cx="451" cy="40" r="16" fill="#ead8c5"/><text x="451" y="45" text-anchor="middle" font-size="12" fill="#836f5d" font-weight="700">\${stepIndex+1}</text>
      <text x="20" y="27" font-size="13" fill="#796a5b" font-weight="700">УЧЕБНЫЙ РАЗБОР · \${stepIndex+1} / \${total}</text>
      <text x="20" y="225" font-size="11" fill="#8f7c6c">Бежевый — петля · Бирюзовый — захваченная нить · Серый — крючок</text>
    </svg>
  \`;
}

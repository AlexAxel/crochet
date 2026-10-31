/**
 * Authoritative, replayable CROCHET STITCH GRAPH.
 * A stitch is an operation with references to the exact base loop(s).
 * It is NOT a sprite, mesh, or a unit of image-space coordinates.
 *
 * This is a controlled subset of crochet: chain, SC, 2 SC in one base, SC2TOG,
 * skip, turn. Graph rules are validated independently of rendering.
 */
export type Command = 'chain' | 'sc' | 'inc' | 'dec' | 'skip' | 'turn';
export type StitchKind = 'chain' | 'sc' | 'sc2tog';
export type Primitive = 'insertHook' | 'yarnOver' | 'drawUpLoop' | 'pullThrough' | 'releaseLoop';

export type Stitch = {
  id: string;
  kind: StitchKind;
  row: number;
  index: number; // order of execution in the row
  parents: string[]; // exact stitch loop(s) entered
  trace: Primitive[]; // executable semantic choreography, not pre-drawn frames
  command: Command;
};

export type Model = {
  rows: Stitch[][];
  cursor: number;
  skipped: string[];
  operations: Command[];
  activeLoopCount: number;
  nextId: number;
  error: string | null;
};

const chainTrace: Primitive[] = ['yarnOver', 'pullThrough'];
const scTrace: Primitive[] = ['insertHook', 'yarnOver', 'drawUpLoop', 'yarnOver', 'pullThrough'];
const decTrace: Primitive[] = [
  'insertHook', 'yarnOver', 'drawUpLoop',
  'insertHook', 'yarnOver', 'drawUpLoop',
  'yarnOver', 'pullThrough',
];

export function initialModel(): Model {
  return { rows: [[]], cursor: -1, skipped: [], operations: [], activeLoopCount: 1, nextId: 1, error: null };
}

export function nextTargets(model: Model): Stitch[] {
  if (model.rows.length < 2 || model.cursor < 0) return [];
  return model.rows[model.rows.length - 2].slice(0, model.cursor + 1).reverse();
}

export function apply(model: Model, command: Command): Model {
  const m: Model = {
    ...model,
    rows: model.rows.map(row => [...row]),
    skipped: [...model.skipped],
    operations: [...model.operations],
    error: null,
  };
  const row = m.rows.length - 1;
  const current = m.rows[row];
  const parentRow = row > 0 ? m.rows[row - 1] : [];

  function add(kind: StitchKind, parents: string[], trace: Primitive[], source: Command) {
    current.push({
      id: 's' + m.nextId++, kind, row,
      index: current.length, parents, trace: [...trace], command: source,
    });
  }

  switch (command) {
    case 'chain':
      if (row !== 0) return { ...model, error: 'Воздушную цепочку создаём до поворота работы.' };
      add('chain', current.length ? [current[current.length - 1].id] : [], chainTrace, command);
      break;
    case 'turn':
      if (row === 0 && current.length < 3)
        return { ...model, error: 'Для начала первого ряда нужны хотя бы 3 воздушные петли.' };
      if (row > 0 && m.cursor >= 0)
        return { ...model, error: 'Сначала обработай оставшиеся петли или пропусти их.' };
      if (current.length === 0) return { ...model, error: 'Нельзя повернуть пустой ряд.' };
      m.rows.push([]);
      m.cursor = current.length - 1;
      break;
    case 'sc':
    case 'inc':
    case 'dec':
    case 'skip': {
      if (row === 0)
        return { ...model, error: 'Сначала создай цепочку и нажми «Повернуть ряд».' };
      if (m.cursor < 0)
        return { ...model, error: 'Ряд закончен. Поверни работу, чтобы продолжить.' };
      const anchor = parentRow[m.cursor];
      if (!anchor) return { ...model, error: 'Нет петли основания.' };
      if (command === 'skip') {
        m.skipped.push(anchor.id);
        m.cursor -= 1;
      } else if (command === 'dec') {
        if (m.cursor < 1)
          return { ...model, error: 'Для СБН2вместе нужны две соседние петли основания.' };
        add('sc2tog', [anchor.id, parentRow[m.cursor - 1].id], decTrace, command);
        m.cursor -= 2;
      } else if (command === 'inc') {
        add('sc', [anchor.id], scTrace, command);
        add('sc', [anchor.id], scTrace, command);
        m.cursor -= 1;
      } else {
        add('sc', [anchor.id], scTrace, command);
        m.cursor -= 1;
      }
      break;
    }
  }
  m.operations.push(command);
  return m;
}

export function replay(commands: readonly Command[]): Model {
  let state = initialModel();
  for (const command of commands) {
    const result = apply(state, command);
    if (result.error) throw new Error('Cannot replay ' + command + ': ' + result.error);
    state = result;
  }
  return state;
}

export function validateGraph(model: Model): string[] {
  const errors: string[] = [];
  const seen = new Map<string, Stitch>();
  for (const [rowIndex, row] of model.rows.entries()) {
    for (const [i, stitch] of row.entries()) {
      if (seen.has(stitch.id)) errors.push('Duplicated stitch id ' + stitch.id);
      if (stitch.row !== rowIndex || stitch.index !== i) errors.push('Wrong position ' + stitch.id);
      if (rowIndex === 0 && stitch.kind !== 'chain') errors.push('Foundation must be a chain');
      if (rowIndex > 0 && stitch.kind === 'chain') errors.push('Chain in fabric row');
      if (rowIndex > 0 && stitch.parents.length !== (stitch.kind === 'sc2tog' ? 2 : 1))
        errors.push('Wrong number of parent loops ' + stitch.id);
      for (const id of stitch.parents) {
        const parent = seen.get(id);
        if (!parent) errors.push('Unknown or forward parent ' + id);
        if (parent && parent.row !== (stitch.kind === 'chain' ? rowIndex : rowIndex - 1))
          errors.push('Nonadjacent row connection ' + stitch.id);
      }
      seen.set(stitch.id, stitch);
    }
  }
  if (model.activeLoopCount !== 1) errors.push('Single-hook work must have one live hook loop');
  return errors;
}

export function makeDemo(): Command[] {
  const actions: Command[] = [];
  for (let i = 0; i < 14; i++) actions.push('chain');
  actions.push('turn');
  for (let i = 0; i < 14; i++) actions.push('sc');
  actions.push('turn');
  for (let i = 0; i < 14; i++) actions.push('sc');
  actions.push('turn');
  for (let i = 0; i < 8; i++) actions.push('sc');
  return actions;
}

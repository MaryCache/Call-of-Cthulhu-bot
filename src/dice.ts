// src/dice.ts
import { Judge } from './types';

export type RollAtom =
  | { kind: 'num'; value: number }
  | { kind: 'dice'; n: number; m: number; rolls: number[]; total: number };

export type EvalResult = {
  total: number;
  detail: string;
  atoms: RollAtom[];
  target?: { total: number; detail: string };
};

const rnd = (m: number) => Math.floor(Math.random() * m) + 1;

export function rollD100(): number {
  return rnd(100);
}

function rollNdM(n: number, m: number): RollAtom {
  const rolls = Array.from({ length: n }, () => rnd(m));
  return {
    kind: 'dice',
    n,
    m,
    rolls,
    total: rolls.reduce((a, b) => a + b, 0),
  };
}

// 末尾の不要な 0 を落として見やすく
function fmt(n: number) {
  const s = n.toFixed(6); // 浮動小数の0.3000000004対策で軽く丸め
  return s.replace(/\.?0+$/, '');
}

export function evalExpression(expr: string): EvalResult {
  const s = expr.replace(/\s+/g, '').toLowerCase().replace(/：/g, ':');

  // 小数を含む数値を許可: \d+(?:\.\d+)?
  const tokens = s.match(/(\d+d\d+|\d+(?:\.\d+)?|[()+\-*/:])/g);
  if (!tokens) throw new Error('式が不正だよ');

  const atoms: RollAtom[] = [];
  const replaced = tokens
    .map((t) => {
      if (/^\d+d\d+$/.test(t)) {
        const [n, m] = t.split('d').map(Number);
        if (!Number.isFinite(n) || !Number.isFinite(m) || n <= 0 || m <= 0)
          throw new Error('ダイス指定が不正だよ');
        const a = rollNdM(n, m);
        const idx = atoms.push(a) - 1;
        return `@${idx}`;
      }
      return t;
    })
    .join('');

  const [left, targetExpr] = replaced.split(':');

  const calc = (exp: string): { total: number; infix: string } => {
    const out: string[] = [];
    const ops: string[] = [];
    const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
    const toks = exp.match(/(@\d+|\d+(?:\.\d+)?|[()+\-*/])/g) ?? [];

    for (const t of toks) {
      if (/^@\d+$/.test(t) || /^\d+(?:\.\d+)?$/.test(t)) out.push(t);
      else if (t === '(') ops.push(t);
      else if (t === ')') {
        while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()!);
        if (!ops.length) throw new Error('カッコ不一致');
        ops.pop();
      } else if (/[+\-*/]/.test(t)) {
        while (
          ops.length &&
          /[+\-*/]/.test(ops[ops.length - 1]) &&
          prec[ops[ops.length - 1]] >= prec[t]
        ) {
          out.push(ops.pop()!);
        }
        ops.push(t);
      }
    }
    while (ops.length) {
      const op = ops.pop()!;
      if (/[()]/.test(op)) throw new Error('カッコ不一致');
      out.push(op);
    }

    const st: number[] = [];
    for (const t of out) {
      if (/^@\d+$/.test(t)) {
        const a = atoms[Number(t.slice(1))];
        st.push((a as any).total);
      } else if (/^\d+(?:\.\d+)?$/.test(t)) {
        st.push(Number(t));
      } else {
        const b = st.pop()!,
          a = st.pop()!;
        if (t === '+') st.push(a + b);
        else if (t === '-') st.push(a - b);
        else if (t === '*') st.push(a * b);
        else if (t === '/') st.push(a / b); // ← 小数対応：切り捨て廃止
      }
    }
    if (st.length !== 1) throw new Error('式評価エラー');

    const infix = exp.replace(/@(\d+)/g, (_, i) => {
      const A = atoms[Number(i)];
      if ((A as any).kind === 'dice') {
        const d = A as any;
        return `${d.rolls.join('+')}(${d.n}d${d.m})`;
      }
      return '';
    });

    return { total: st[0], infix };
  };

  const L = calc(left);
  let detail = L.infix || left;
  let total = L.total;

  if (targetExpr !== undefined) {
    const T = calc(targetExpr);
    detail = `${detail} : ${T.infix || targetExpr}`;
    return {
      total,
      detail,
      atoms,
      target: { total: T.total, detail: T.infix || targetExpr },
    };
  }
  return { total, detail, atoms };
}

export function hasD100(atoms: RollAtom[]) {
  return atoms.some(
    (a: any) => a.kind === 'dice' && a.n === 1 && a.m === 100,
  );
}

export function judgeD100(target: number, roll: number): Judge {
  const t = Math.floor(target);
  if (roll <= t) return roll >= 1 && roll <= 5 ? 'クリティカル' : '成功';
  return roll >= 96 && roll <= 100 ? 'ファンブル' : '失敗';
}
export function judgeGeneric(target: number, total: number): Judge {
  return total <= target ? '成功' : '失敗';
}

// 数字だけの簡易式（補正用）— 小数OK・ダイス禁止
export function evalNumeric(expr: string): number {
  let s = (expr || '').replace(/\s+/g, '').replace(/：/g, ':');
  if (!s) return 0;
  // 単項 +/− を 0 を前置して二項に正規化
  if (/^[+\-]/.test(s)) s = '0' + s;
  if (/[^0-9+\-*/().]/.test(s)) throw new Error('補正は数式だけにしてね');
  const r = evalExpression(s);
  if (r.atoms.length) throw new Error('補正にダイスは使えないよ');
  return r.total;
}

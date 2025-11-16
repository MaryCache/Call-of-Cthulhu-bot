// src/render.ts
import { listAbilities, listSkills } from './db';
import { Section } from './types';

type RenderOptions = { omitInitial?: boolean };

// セクションごとに独立したコードブロックで描画
export function renderShow(charRow: any, opts: RenderOptions = {}): string {
  const charId = charRow.id as number;

  const ab = listAbilities.all(charId) as {
    key: string;
    base: number;
    delta: number;
  }[];
  const abMap = new Map(ab.map((a) => [a.key, a] as const));

  const secOrder: Section[] = ['戦闘技能', '探索技能', '行動技能', '交渉技能', '知識技能'];
  const skills = listSkills.all(charId) as {
    section: Section;
    key: string;
    aliases: string;
    base: number;
    delta: number;
  }[];

  const grouped: Record<Section, typeof skills> = {
    戦闘技能: [],
    探索技能: [],
    行動技能: [],
    交渉技能: [],
    知識技能: [],
  } as any;
  for (const s of skills) grouped[s.section].push(s);

  const block = (...lines: string[]) => ['```', ...lines, '```'].join('\n');
  const blocks: string[] = [];

  // 基本情報
  {
    const b: string[] = [];
    b.push(`名前：${charRow.name}`);
    if (charRow.job) b.push(`職業：${charRow.job}`);
    if (typeof charRow.age === 'number') b.push(`年齢：${charRow.age}`);
    if (charRow.sex) b.push(`性別：${charRow.sex}`);
    if (charRow.origin) b.push(`出身：${charRow.origin}`);
    blocks.push(block(...b));
  }

  // HP/MP/SAN
  {
    const b: string[] = [];
    const hpMax = charRow.hp_max ?? charRow.hp ?? 0;
    const mpMax = charRow.mp_max ?? charRow.mp ?? 0;
    const sanMax = charRow.san_max ?? charRow.san ?? 0;
    b.push(`HP：${charRow.hp ?? 0}/${hpMax}`);
    b.push(`MP：${charRow.mp ?? 0}/${mpMax}`);
    b.push(`SAN：${charRow.san ?? 0}/${sanMax}`);
    blocks.push(block(...b));
  }

  // 能力値
  {
    const abilityOrder = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU', 'IDE', '幸運', '知識'];
    const b: string[] = [];
    for (const k of abilityOrder) {
      const A = abMap.get(k);
      if (A) b.push(`${k}：${A.base + A.delta}`);
    }
    if (charRow.db_str) b.push(`DB：${charRow.db_str}`);
    blocks.push(block(...b));
  }

  // 各技能セクション
  for (const sec of secOrder) {
    const arrAll = grouped[sec];
    const arr = opts.omitInitial ? arrAll.filter((s) => s.delta !== 0) : arrAll;
    if (!arr || !arr.length) continue;

    const b: string[] = [];
    b.push(`『${sec}』`);
    for (const s of arr) {
      const cur = s.base + s.delta;
      if (s.delta === 0) b.push(`${s.key}：${cur}`);
      else b.push(`${s.key}：${cur}（初期${s.base}）`);
    }
    blocks.push(block(...b));
  }

  return blocks.join('\n\n');
}

export function renderGrowth(charRow: any): string {
  const charId = charRow.id as number;
  const ab = listAbilities.all(charId) as { key: string; base: number; delta: number }[];
  const sk = listSkills.all(charId) as { key: string; base: number; delta: number; section: string; aliases: string }[];

  const lines: string[] = [];
  lines.push('```');
  lines.push(`${charRow.name} 成長度`);
  for (const a of ab) if (a.delta !== 0) lines.push(`${a.key}：${a.delta >= 0 ? '+' : ''}${a.delta}`);
  for (const s of sk) if (s.delta !== 0) lines.push(`${s.key}：${s.delta >= 0 ? '+' : ''}${s.delta}`);
  if (lines.length === 2) lines.push('（変動なし）');
  lines.push('```');

  return lines.join('\n');
}

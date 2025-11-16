// src/freeDice.ts
import { Client, Message } from 'discord.js';
import {
  evalExpression,
  hasD100,
  judgeD100,
  judgeGeneric,
  evalNumeric,
  rollD100,
} from './dice';
import {
  getOrCreateUser,
  getSelection,
  getCharById,
  listAbilities,
  listSkills,
} from './db';

// ===== 表示用ユーティリティ =====
function fmt(n: number) {
  if (Number.isInteger(n)) return String(n);
  return String(+n.toFixed(6)).replace(/\.?0+$/, '');
}
function codeBlock(lines: (string | number)[]) {
  return ['```', ...lines.map(String), '```'].join('\n');
}

// 全角演算子の正規化
function normalizeOps(s: string) {
  return (s || '')
    .replace(/[×＊]/g, '*')
    .replace(/[÷／]/g, '/')
    .replace(/：/g, ':');
}

// 「後ろのテキストが“数式だけ”か」をチェック（空文字はOK）
function isArithmeticTail(s: string) {
  const r = normalizeOps(s).trim();
  if (!r) return true;
  return /^[0-9+\-*/().\s]+$/.test(r);
}

// 「全文が“数式だけ”か」をチェック
// ただの数値（整数/小数）は無視するように変更
function isPureDiceExpression(s: string) {
  const t = normalizeOps(s).trim().toLowerCase();
  if (!t) return false;
  if (!/^[\d d+\-*/():.\s]+$/.test(t)) return false;
  // 数字だけ（例: "40", "12.5"）は無視
  if (/^\d+(?:\.\d+)?$/.test(t)) return false;
  // ダイス表記 or 演算子/カッコ/目標値記号が含まれるならOK
  return /(\d+d\d+)|[+\-*/():]/.test(t);
}

// ===== 内部ユーティリティ =====
function buildSkillIndex(charId: number) {
  const rows = listSkills.all(charId) as {
    section: string;
    key: string;
    aliases: string;
    base: number;
    delta: number;
  }[];
  const index = new Map<
    string,
    { section: string; key: string; base: number; delta: number }
  >();
  for (const r of rows) {
    const aliases: string[] = JSON.parse(r.aliases || '[]');
    const names = new Set<string>([r.key]);
    for (const al of aliases) names.add(al);
    // 「こぶし（パンチ）」→「こぶし」でも引けるように
    const plain = r.key.replace(/（.+?）$/, '');
    names.add(plain);
    for (const name of names)
      index.set(name, {
        section: r.section,
        key: r.key,
        base: r.base,
        delta: r.delta,
      });
  }
  return index;
}

function buildAbilityIndex(charId: number) {
  const rows = listAbilities.all(charId) as {
    key: string;
    base: number;
    delta: number;
  }[];
  // 大文字・小文字両対応で引けるように、両方のキーを登録
  const index = new Map<string, { key: string; base: number; delta: number }>();
  for (const r of rows) {
    index.set(r.key, { key: r.key, base: r.base, delta: r.delta });
    index.set(r.key.toLowerCase(), { key: r.key, base: r.base, delta: r.delta });
  }
  return index;
}

function longestMatchingKey(input: string, keys: string[]): string | null {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  for (const k of sorted) if (input.startsWith(k)) return k;
  return null;
}

// ===== メッセージでの自由ダイス（常時有効） =====
export function installFreeDiceHandler(client: Client) {
  client.on('messageCreate', async (message: Message) => {
    try {
      if (message.author.bot) return;

      const content = message.content.trim();
      const text = normalizeOps(content);

      // ユーザー確定
      const userId = message.author.id;
      getOrCreateUser.run(userId, message.author.username);

      const sel = getSelection.get(userId) as { char_id: number } | undefined;

      // ---- 0) SAN / san を最優先で処理（後ろが“数式だけ”でないなら無視）----
      const mSan = text.match(/^san\b(.*)$/i);
      if (mSan) {
        const tail = (mSan[1] || '');
        if (!isArithmeticTail(tail)) return; // 会話っぽい → 反応しない

        if (!sel) return; // 選択キャラなしは静かに無視
        const row = getCharById.get(sel.char_id) as any;
        if (!row) return;

        const rest = normalizeOps(tail).trim();
        const base = Number(row.san ?? 0);
        let target = base;
        let exprTxt = String(base);
        if (rest) {
          const needsPlus = /^[\d(]/.test(rest);
          exprTxt = `${base}${needsPlus ? '+' : ''}${rest}`;
          target = evalNumeric(exprTxt);
        }

        const r = rollD100();
        const j = judgeD100(target, r);
        const label = `SAN（現在${base}）`;
        const block = codeBlock([
          `式: ${exprTxt}`,
          `1d100 = ${r}`,
          `目標 = ${fmt(target)}`,
          `→ ${j}`,
        ]);
        await message.reply(`${label}\n${block}`);
        return;
      }

      // 選択中キャラ情報（あれば）
      const charRow = sel ? (getCharById.get(sel.char_id) as any) : null;

      // インデックス（能力→技能の順で優先判定）
      const abIdx = sel && charRow ? buildAbilityIndex(sel.char_id) : null;
      const skillIdx = sel && charRow ? buildSkillIndex(sel.char_id) : null;

      // ---- 1) 能力名 [+/-/*//(...)] で 1d100（後ろが数式でないなら無視）----
      if (abIdx) {
        const abKey = longestMatchingKey(text.toLowerCase(), [...abIdx.keys()]);
        if (abKey && abIdx.has(abKey)) {
          const A = abIdx.get(abKey)!;
          const origHead = text.slice(0, A.key.length);
          const restRaw = text.slice(origHead.length);
          if (!isArithmeticTail(restRaw)) return; // 会話っぽい → 反応しない

          const rest = normalizeOps(restRaw).trim();
          const baseVal = (A.base ?? 0) + (A.delta ?? 0);

          let target = baseVal;
          let exprTxt = String(baseVal);
          if (rest) {
            const needsPlus = /^[\d(]/.test(rest);
            exprTxt = `${baseVal}${needsPlus ? '+' : ''}${rest}`;
            target = evalNumeric(exprTxt);
          }

          const r = rollD100();
          const j = judgeD100(target, r);
          const growthPart = A.delta ? `, 成長${A.delta >= 0 ? '+' : ''}${A.delta}` : '';
          const label = `${A.key}（基礎${A.base}${growthPart}）`;
          const block = codeBlock([
            `式: ${exprTxt}`,
            `1d100 = ${r}`,
            `目標 = ${fmt(target)}`,
            `→ ${j}`,
          ]);
          await message.reply(`${label}\n${block}`);
          return;
        }
      }

      // ---- 2) 技能名 [+/-/*//(...)] で 1d100（後ろが数式でないなら無視）----
      if (skillIdx) {
        const key = longestMatchingKey(text, [...skillIdx.keys()]);
        if (key && skillIdx.has(key)) {
          const tail = text.slice(key.length);
          if (!isArithmeticTail(tail)) return; // 会話っぽい → 反応しない

          const S = skillIdx.get(key)!;
          const rest = normalizeOps(tail).trim();

          const baseVal = (S.base ?? 0) + (S.delta ?? 0);
          let target = baseVal;
          let exprTxt = String(baseVal);
          if (rest) {
            const needsPlus = /^[\d(]/.test(rest);
            exprTxt = `${baseVal}${needsPlus ? '+' : ''}${rest}`;
            target = evalNumeric(exprTxt);
          }

          const r = rollD100();
          const j = judgeD100(target, r);
          const growthPart = S.delta ? `, 成長${S.delta >= 0 ? '+' : ''}${S.delta}` : '';
          const label = `${S.key}（基礎${S.base}${growthPart}）`;
          const block = codeBlock([
            `式: ${exprTxt}`,
            `1d100 = ${r}`,
            `目標 = ${fmt(target)}`,
            `→ ${j}`,
          ]);
          await message.reply(`${label}\n${block}`);
          return;
        }
      }

      // ---- 3) フリーダイス/数式：全文が数式だけのときだけ反応 ----
      if (!isPureDiceExpression(text)) return;

      const res = evalExpression(text);
      if (res.target) {
        if (hasD100(res.atoms)) {
          const d100Atom = res.atoms.find(
            (a: any) => a.kind === 'dice' && a.n === 1 && a.m === 100,
          ) as any;
          const roll = d100Atom ? d100Atom.total : res.total;
          const j = judgeD100(res.target.total, roll);
          const block = codeBlock([
            `式: ${res.detail}`,
            `1d100 = ${roll}`,
            `目標 = ${fmt(res.target.total)}`,
            `→ ${j}`,
          ]);
          await message.reply(block);
        } else {
          const j = judgeGeneric(res.target.total, res.total);
          const block = codeBlock([
            `式: ${res.detail}`,
            `結果 = ${fmt(res.total)}`,
            `目標 = ${fmt(res.target.total)}`,
            `→ ${j}`,
          ]);
          await message.reply(block);
        }
      } else {
        const block = codeBlock([
          `式: ${res.detail}`,
          `結果 = ${fmt(res.total)}`,
        ]);
        await message.reply(block);
      }
    } catch (e: any) {
      try {
        await message.reply(codeBlock([`エラー: ${e.message ?? e}`]));
      } catch { /* no-op */ }
    }
  });
}

// src/parser.ts
import { ParsedChar, ParsedSkill, Section, ABILITY_KEYS } from './types';

// いあきゃらのテキストをパースして DB へ入れやすい形にする
export function parseIaChar(raw: string): ParsedChar {
  // 改行と全角コロンの正規化
  const txt = (raw ?? '').replace(/\r\n?/g, '\n');

  // 便利関数
  const g = (re: RegExp) => {
    const m = txt.match(re);
    return (m?.[1] ?? '').trim();
  };
  const n = (re: RegExp) => {
    const v = g(re);
    const k = Number(v);
    return Number.isFinite(k) ? k : undefined;
  };

  // 基本情報
  const name = g(/^名前[：:]\s*(.+)$/m) || g(/^名前\s*\|\s*(.+)$/m);
  if (!name) throw new Error('名前が見つからないよ');

  const job = g(/^職業[：:]\s*(.+)$/m) || undefined;
  const age = n(/^年齢[：:]\s*(\d+)/m);
  const sex = g(/性別[：:]\s*([^\s/]+)/m) || undefined;
  const origin = g(/^出身[：:]\s*(.+)$/m) || undefined;

  // アイコンは「【アイコン】\n:URL」や「【アイコン】：URL」両対応
  const icon =
    (txt.match(/^【アイコン】[^\n]*\n:\s*(\S+)/m)?.[1] ??
      txt.match(/^【アイコン】[：:]\s*(\S+)/m)?.[1]) || undefined;

  // 能力値（STR/CON/.../IDE/幸運/知識）
  const abilities: { key: string; base: number }[] = [];
  for (const k of ABILITY_KEYS) {
    const val = n(new RegExp(`^${k}\\s+(\\d+)`, 'm'));
    if (typeof val === 'number') abilities.push({ key: k, base: val });
  }

  // HP/MP/SAN（現在SAN値 60 / 99 形式がある場合は SAN の最大も取得）
  const hp = n(/^HP\s+(\d+)/m);
  const mp = n(/^MP\s+(\d+)/m);

  // 「SAN 60」行（能力テーブル）を拾いつつ、「現在SAN値 60 / 99」を優先
  const sanFromTable = n(/^SAN\s+(\d+)/m);
  const sanPair = txt.match(/現在SAN値\s*(\d+)\s*\/\s*(\d+)/m);
  const san = sanPair ? Number(sanPair[1]) : sanFromTable;
  const sanMax = sanPair ? Number(sanPair[2]) : undefined;

  // DB（ダメージボーナス）
  const dbStr =
    g(/^DB\s+([+\-]?\w+)/mi) ||
    g(/^ダメージボーナス[：:]\s*([+\-]?\w+)/mi) ||
    undefined;

  // 技能セクションの抽出
  const skills: ParsedSkill[] = [];
  const seen = new Set<string>();
  const blocks = Array.from(
    txt.matchAll(
      /『(戦闘技能|探索技能|行動技能|交渉技能|知識技能)』([\s\S]*?)(?=『(戦闘技能|探索技能|行動技能|交渉技能|知識技能)』|$)/g,
    ),
  );

  for (const m of blocks) {
    const section = m[1] as Section;
    const body = m[2];
    const lines = body
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('技能名')); // 見出し行を除外

    for (const line of lines) {
      // 例: "目星                      60      25      10      25       0       0"
      const mm =
        line.match(
          /^(.+?)\s+(\d+)\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+$/,
        ) ||
        // 多少列が崩れた場合の甘めパターン（合計と初期値さえ拾えればOK）
        line.match(/^(.+?)\s+(\d+)\s+(\d+)\b/);

      if (!mm) continue;

      const key = mm[1].trim();
      const sum = Number(mm[2]);
      const base = Number(mm[3]);
      if (!Number.isFinite(sum) || !Number.isFinite(base)) continue;

      const delta = sum - base;
      const alias = key.match(/^(.+?)（(.+?)）$/); // 「こぶし（パンチ）」の括弧内を別名に
      const aliases = alias ? [alias[1].trim(), alias[2].trim()] : [];

      const uniq = `${section}|${key}|${base}`;
      if (seen.has(uniq)) continue;
      seen.add(uniq);

      skills.push({ section, key, base, delta, aliases });
    }
  }

  return {
    name,
    job,
    age,
    sex,
    origin,
    icon,
    hp,
    mp,
    san,
    sanMax,
    db: dbStr,
    abilities,
    skills,
  };
}

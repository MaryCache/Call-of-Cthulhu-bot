// src/types.ts

// セクション種別
export type Section = '戦闘技能' | '探索技能' | '行動技能' | '交渉技能' | '知識技能';

// 技能
export interface ParsedSkill {
  section: Section;
  key: string;
  base: number;
  delta: number;
  aliases: string[];
}

// 取り込みキャラ
export interface ParsedChar {
  name: string;
  job?: string;
  age?: number;
  sex?: string;
  origin?: string;
  icon?: string;
  hp?: number;
  mp?: number;
  san?: number;
  sanMax?: number;
  db?: string;
  abilities: { key: string; base: number }[]; // STR/CON/.../IDE/幸運/知識
  skills: ParsedSkill[];
}

// 判定結果
export type Judge = '成功' | '失敗' | 'クリティカル' | 'ファンブル';

// 能力キー
export const ABILITY_KEYS = [
  'STR',
  'CON',
  'POW',
  'DEX',
  'APP',
  'SIZ',
  'INT',
  'EDU',
  'IDE',
  '幸運',
  '知識',
] as const;

export type AbilityKey = typeof ABILITY_KEYS[number];

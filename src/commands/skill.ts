// src/commands/skill.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import {
  addSkillDelta,
  setSkillDelta,
  getSelection,
  listSkills,
  listPanelsByUser,
  getCharById,
} from '../db';
import { renderShow } from '../render';

// 技能名の解決（別名・括弧抜き・最長一致）
function buildIndex(charId: number) {
  const rows = listSkills.all(charId) as {
    section: string;
    key: string;
    aliases: string;
    base: number;
    delta: number;
  }[];
  const index = new Map<string, { key: string }>();
  for (const r of rows) {
    const aliases: string[] = JSON.parse(r.aliases || '[]');
    const names = new Set<string>([r.key, r.key.replace(/（.+?）$/, '')]);
    for (const al of aliases) names.add(al);
    for (const nm of names) index.set(nm, { key: r.key });
  }
  return index;
}

export const data = new SlashCommandBuilder()
  .setName('skill')
  .setDescription('技能の成長を反映')
  .addSubcommand((sc) =>
    sc
      .setName('add')
      .setDescription('技能の成長値を加算')
      .addStringOption((o) =>
        o.setName('name').setDescription('技能名（例：目星）').setRequired(true),
      )
      .addIntegerOption((o) =>
        o.setName('value').setDescription('±加算').setRequired(true),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName('set')
      .setDescription('技能の成長値を設定')
      .addStringOption((o) =>
        o.setName('name').setDescription('技能名').setRequired(true),
      )
      .addIntegerOption((o) =>
        o.setName('value').setDescription('設定値').setRequired(true),
      ),
  );

export async function handle(i: ChatInputCommandInteraction) {
  const sel = getSelection.get(i.user.id) as { char_id: number } | undefined;
  if (!sel) {
    return void (await i.reply({
      content: 'まず /characters でキャラを選択してね',
      ephemeral: true,
    }));
  }

  const sub = i.options.getSubcommand(true);
  const inputName = i.options.getString('name', true).trim();
  const val = i.options.getInteger('value', true);

  const idx = buildIndex(sel.char_id);
  // 完全一致→最長一致の順で解決
  const resolvedKey =
    idx.get(inputName)?.key ??
    [...idx.keys()].sort((a, b) => b.length - a.length).find((k) =>
      inputName.startsWith(k),
    );

  if (!resolvedKey) {
    return void (await i.reply({
      content: `その技能が見つからないよ：「${inputName}」`,
      ephemeral: true,
    }));
  }

  if (sub === 'add') addSkillDelta.run(val, sel.char_id, resolvedKey);
  else setSkillDelta.run(val, sel.char_id, resolvedKey);

  const row = getCharById.get(sel.char_id) as any;

  await i.reply({
    content: `技能『${resolvedKey}』に ${
      sub === 'add' ? (val >= 0 ? '+' : '') + val : '成長値を' + val
    } 反映したよ`,
    ephemeral: true,
  });

  // /show で貼ったパネルを全更新
  const panels = listPanelsByUser.all(i.user.id) as {
    channel_id: string;
    message_id: string;
  }[];
  for (const p of panels) {
    try {
      const ch = await i.client.channels.fetch(p.channel_id);
      if (!ch?.isTextBased()) continue;
      const msg = await ch.messages.fetch(p.message_id).catch(() => null);
      if (msg) await msg.edit(renderShow(row));
    } catch {
      // 壊れてるパネルは無視
    }
  }
}

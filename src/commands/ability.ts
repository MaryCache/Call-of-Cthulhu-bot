// src/commands/ability.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import {
  addAbilityDelta,
  setAbilityDelta,
  getSelection,
  listPanelsByUser,
  getCharById,
} from '../db';
import { ABILITY_KEYS } from '../types';
import { renderShow } from '../render';

export const data = new SlashCommandBuilder()
  .setName('ability')
  .setDescription('能力の成長を反映')
  .addSubcommand((sc) =>
    sc
      .setName('add')
      .setDescription('能力の成長値を加算')
      .addStringOption((o) =>
        o
          .setName('key')
          .setDescription('能力（STR, CON, …, 知識）')
          .addChoices(...ABILITY_KEYS.map((k) => ({ name: k, value: k } as const)))
          .setRequired(true),
      )
      .addIntegerOption((o) =>
        o.setName('value').setDescription('±加算').setRequired(true),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName('set')
      .setDescription('能力の成長値を設定')
      .addStringOption((o) =>
        o
          .setName('key')
          .setDescription('能力（STR, CON, …, 知識）')
          .addChoices(...ABILITY_KEYS.map((k) => ({ name: k, value: k } as const)))
          .setRequired(true),
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
  const key = i.options.getString('key', true);
  const val = i.options.getInteger('value', true);

  if (sub === 'add') addAbilityDelta.run(val, sel.char_id, key);
  else setAbilityDelta.run(val, sel.char_id, key);

  const row = getCharById.get(sel.char_id) as any;

  await i.reply({
    content: `能力『${key}』に ${
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

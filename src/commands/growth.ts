// src/commands/growth.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getSelection, getCharById } from '../db';
import { renderGrowth } from '../render';

export const data = new SlashCommandBuilder()
  .setName('growth')
  .setDescription('選択中キャラの成長度一覧を表示');

export async function handle(i: ChatInputCommandInteraction) {
  const sel = getSelection.get(i.user.id) as { char_id: number } | undefined;
  if (!sel) {
    return void (await i.reply({
      content: 'まず /characters でキャラを選択してね',
      ephemeral: true,
    }));
  }

  const row = getCharById.get(sel.char_id) as any;
  if (!row) {
    return void (await i.reply({
      content: '選択中のキャラが見つからないよ',
      ephemeral: true,
    }));
  }

  await i.reply({ content: renderGrowth(row) });
}

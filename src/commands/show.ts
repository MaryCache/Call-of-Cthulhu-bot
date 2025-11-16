// src/commands/show.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getSelection, getCharById, addPanel } from '../db';
import { renderShow } from '../render';

export const data = new SlashCommandBuilder()
  .setName('show')
  .setDescription('選択中キャラの概要を表示')
  .addStringOption(o =>
    o
      .setName('skills')
      .setDescription('技能の表示方法')
      .addChoices(
        { name: '全て表示', value: 'all' },
        { name: '初期値は省略', value: 'omit' },
      )
      .setRequired(false),
  );

export async function handle(i: ChatInputCommandInteraction) {
  const sel = getSelection.get(i.user.id) as { char_id: number } | undefined;
  if (!sel) {
    return void (await i.reply({
      content: 'まず /characters からキャラを選んでね',
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

  const mode = i.options.getString('skills', false) ?? 'all';
  const omitInitial = mode === 'omit';

  // パブリックに表示して、以後の変更で編集更新できるように紐付ける
  const msg = await i.reply({
    content: renderShow(row, { omitInitial }),
    fetchReply: true,
  });
  addPanel.run(i.user.id, msg.channelId, msg.id);
}

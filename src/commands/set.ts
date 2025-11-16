// src/commands/set.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import {
  getSelection,
  updateCharHP,
  updateCharMP,
  updateCharSAN,
  getCharById,
  listPanelsByUser,
} from '../db';
import { renderShow } from '../render';

export const data = new SlashCommandBuilder()
  .setName('set')
  .setDescription('HP/MP/SANの現在値を設定')
  .addStringOption((o) =>
    o
      .setName('stat')
      .setDescription('hp / mp / san')
      .addChoices(
        { name: 'hp', value: 'hp' },
        { name: 'mp', value: 'mp' },
        { name: 'san', value: 'san' },
      )
      .setRequired(true),
  )
  .addIntegerOption((o) =>
    o.setName('value').setDescription('設定値').setRequired(true),
  );

export async function handle(i: ChatInputCommandInteraction) {
  const sel = getSelection.get(i.user.id) as { char_id: number } | undefined;
  if (!sel) {
    return void (await i.reply({
      content: 'まず /characters でキャラを選択してね',
      ephemeral: true,
    }));
  }

  const stat = i.options.getString('stat', true).toLowerCase();
  const val = i.options.getInteger('value', true);

  if (stat === 'hp') updateCharHP.run(val, sel.char_id);
  else if (stat === 'mp') updateCharMP.run(val, sel.char_id);
  else updateCharSAN.run(val, sel.char_id);

  // 即時フィードバック（控えめにエフェメラル）
  await i.reply({
    content: `${stat.toUpperCase()} を ${val} に設定したよ`,
    ephemeral: true,
  });

  // showパネルを全更新
  const latest = getCharById.get(sel.char_id) as any;
  const panels = listPanelsByUser.all(i.user.id) as {
    channel_id: string;
    message_id: string;
  }[];

  for (const p of panels) {
    try {
      const ch = await i.client.channels.fetch(p.channel_id);
      if (!ch?.isTextBased()) continue;
      const msg = await ch.messages.fetch(p.message_id).catch(() => null);
      if (msg) await msg.edit(renderShow(latest));
    } catch {
      // 壊れたパネルは無視（次回以降の表示で上書きされる）
    }
  }
}

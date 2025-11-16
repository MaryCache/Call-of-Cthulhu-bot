// src/commands/add.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import {
  getSelection,
  getCharById,
  updateCharHP,
  updateCharMP,
  updateCharSAN,
  listPanelsByUser,
} from '../db';
import { renderShow } from '../render';

export const data = new SlashCommandBuilder()
  .setName('add')
  .setDescription('HP/MP/SANの現在値に加算')
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
    o.setName('delta').setDescription('±加算').setRequired(true),
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
  const d = i.options.getInteger('delta', true);

  const row = getCharById.get(sel.char_id) as any;
  if (!row) {
    return void (await i.reply({
      content: '選択中のキャラが見つからないよ',
      ephemeral: true,
    }));
  }

  if (stat === 'hp') updateCharHP.run((row.hp ?? 0) + d, sel.char_id);
  else if (stat === 'mp') updateCharMP.run((row.mp ?? 0) + d, sel.char_id);
  else updateCharSAN.run((row.san ?? 0) + d, sel.char_id);

  // 反映メッセージ（控えめにエフェメラル）
  await i.reply({
    content: `${stat.toUpperCase()} を ${d >= 0 ? '+' : ''}${d} したよ`,
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
      // 壊れたパネルは無視
    }
  }
}

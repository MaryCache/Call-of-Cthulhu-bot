// src/commands/characters.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  db,
  setSelection,
  clearSelectionOnDelete,
  deleteCharacter,
  getCharById,
} from '../db';

export const data = new SlashCommandBuilder()
  .setName('characters')
  .setDescription('自分のキャラクター一覧を表示（ボタンで選択/削除）');

export async function handle(i: ChatInputCommandInteraction) {
  const rows = db
    .prepare(
      `SELECT id, name FROM characters WHERE user_id=? ORDER BY updated_at DESC`,
    )
    .all(i.user.id) as { id: number; name: string }[];

  if (!rows.length) {
    return void (await i.reply({
      content: '登録キャラがないよ。まずは /import で取り込んでね。',
      ephemeral: true,
    }));
  }

  const lines = rows.map((r) => `・${r.name} (id:${r.id})`).join('\n');

    // TODO: 将来はページング（Prev/Next）を実装する。customIdに page=<n> を含める。
    // ボタンは最大10件（暫定拡張。UI崩れ防止のため10まで）
    const maxButtons = 10;
  const slice = rows.slice(0, maxButtons);

  const components = slice.map((r) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`char.select:${r.id}`)
        .setLabel(`選択: ${r.name}`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`char.delete:${r.id}`)
        .setLabel(`削除: ${r.name}`)
        .setStyle(ButtonStyle.Danger),
    ),
  );

  await i.reply({
    content:
      `あなたのキャラ一覧\n\n${lines}\n\n` +
      (rows.length > maxButtons
        ? `※ボタンは先頭 ${maxButtons} 件のみ表示。続きは再度 /characters を実行してね。`
        : ''),
    components,
    ephemeral: true,
  });
}

// ボタンハンドラ（/index.ts 側から呼ばれる）
export async function handleButton(customId: string, i: any) {
  if (customId.startsWith('char.select:')) {
    const id = Number(customId.split(':')[1]);
    const row = getCharById.get(id) as any;
    if (!row) {
      return void (await i.reply({
        content: `id:${id} のキャラが見つからないよ`,
        ephemeral: true,
      }));
    }
    setSelection.run(i.user.id, id);
    return void (await i.reply({
      content: `選択中キャラを『${row.name}』(id:${id}) にしたよ。/show で確認してね`,
      ephemeral: true,
    }));
  }

  if (customId.startsWith('char.delete:')) {
    const id = Number(customId.split(':')[1]);
    const row = getCharById.get(id) as any;
    deleteCharacter.run(id);
    clearSelectionOnDelete.run(i.user.id, id);

    return void (await i.reply({
      content: row
        ? `『${row.name}』(id:${id}) を削除したよ。必要なら /characters をもう一度。`
        : `キャラ id:${id} を削除したよ。必要なら /characters をもう一度。`,
      ephemeral: true,
    }));
  }
}

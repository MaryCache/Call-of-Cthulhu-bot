// src/commands/import.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { parseIaChar } from '../parser';
import {
  db,
  getCharByUserAndName,
  deleteAbilities,
  deleteSkills,
  insertAbility,
  insertSkill,
  upsertCharacterStmt,
  setSelection,
} from '../db';

export const data = new SlashCommandBuilder()
  .setName('import')
  .setDescription('いあきゃらのテキストを取り込む（テキスト or 添付）')
  .addStringOption((o) =>
    o
      .setName('text')
      .setDescription('いあきゃら出力をそのまま貼る（長文はfile推奨）')
      .setRequired(false),
  )
  .addAttachmentOption((o) =>
    o
      .setName('file')
      .setDescription('いあきゃら出力の .txt（UTF-8）')
      .setRequired(false),
  );

export async function handle(i: ChatInputCommandInteraction) {
  const userId = i.user.id;

  let text = i.options.getString('text', false) ?? '';
  const file = i.options.getAttachment('file');

  if (file) {
    try {
      const res = await fetch(file.url);
      text = await res.text();
    } catch (e: any) {
      return void (await i.reply({
        content: `ファイルを読めなかったよ：${e?.message ?? e}`,
        ephemeral: true,
      }));
    }
  }

  if (!text.trim()) {
    return void (await i.reply({
      content: 'テキストかファイルのどちらかを渡してね',
      ephemeral: true,
    }));
  }

  try {
    const p = parseIaChar(text);

    const tx = db.transaction(() => {
      upsertCharacterStmt.run(
        userId,
        p.name,
        p.job ?? null,
        p.age ?? null,
        p.sex ?? null,
        p.origin ?? null,
        p.icon ?? null,
        p.hp ?? null,
        p.hp ?? null,
        p.mp ?? null,
        p.mp ?? null,
        p.san ?? null,
        p.sanMax ?? p.san ?? null,
        p.db ?? null,
      );
      const char = getCharByUserAndName.get(userId, p.name) as any;
      deleteAbilities.run(char.id);
      deleteSkills.run(char.id);
      for (const A of p.abilities) insertAbility.run(char.id, A.key, A.base, 0);
      for (const S of p.skills)
        insertSkill.run(
          char.id,
          S.section,
          S.key,
          JSON.stringify(S.aliases),
          S.base,
          S.delta,
        );
      // 取り込み直後はそのキャラを選択状態にする
      setSelection.run(userId, char.id);
    });
    tx();

    await i.reply({
      content: `『${p.name}』を取り込んだよ。/show で確認してね。`,
    });
  } catch (e: any) {
    await i.reply({
      content: `取り込みに失敗：${e?.message ?? e}`,
      ephemeral: true,
    });
  }
}

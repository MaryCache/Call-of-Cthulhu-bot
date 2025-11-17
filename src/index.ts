// src/index.ts
import * as dotenv from 'dotenv';
dotenv.config();

import {
  Client,
  GatewayIntentBits,
  Partials,
  ApplicationCommandDataResolvable,
  Interaction,
} from 'discord.js';

// ここは「src/index.ts」なので "./..." でOK（"./src/..." はNG）
import { installFreeDiceHandler } from './freeDice';
import * as cmdImport from './commands/import';
import * as cmdShow from './commands/show';
import * as cmdSet from './commands/set';
import * as cmdAdd from './commands/add';
import * as cmdSkill from './commands/skill';
import * as cmdAbility from './commands/ability';
import * as cmdGrowth from './commands/growth';
import * as cmdChars from './commands/characters';
import { getOrCreateUser } from './db';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// ====== Slash登録 ======
const modules = {
  import: cmdImport,
  show: cmdShow,
  set: cmdSet,
  add: cmdAdd,
  skill: cmdSkill,
  ability: cmdAbility,
  growth: cmdGrowth,
  characters: cmdChars,
} as const;

function collectCommands(): ApplicationCommandDataResolvable[] {
  return Object.values(modules).map((m: any) =>
    m.data?.toJSON ? m.data.toJSON() : m.data
  );
}

async function registerGuildCommands() {
  for (const [, guild] of client.guilds.cache) {
    try {
      await guild.commands.set(collectCommands());
      console.log(`[slash] registered for guild: ${guild.name} (${guild.id})`);
    } catch (e) {
      console.error(`[slash] failed for guild ${guild?.id}`, e);
    }
  }
}

client.on('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  await registerGuildCommands();
});
client.on('guildCreate', async () => {
  await registerGuildCommands();
});

// ====== Interaction ルーティング ======
client.on('interactionCreate', async (i: Interaction) => {
  try {
    if (i.isChatInputCommand()) {
      const display = (i.user as any).globalName ?? i.user.username ?? `${i.user.id}`;
      getOrCreateUser.run(i.user.id, display);
      const name = i.commandName as keyof typeof modules;
      const mod = modules[name];
      if (!mod) return;
      await (mod as any).handle(i);
    } else if (i.isButton()) {
      // /characters のボタン（選択・削除）
      await cmdChars.handleButton(i.customId, i);
    }
  } catch (e: any) {
    if (i.isRepliable()) {
      if (i.deferred || i.replied) {
        await i.followUp({ content: `エラー：${e.message ?? e}`, ephemeral: true });
      } else {
        await i.reply({ content: `エラー：${e.message ?? e}`, ephemeral: true });
      }
    }
  }
});

// ====== メッセージでの自由ダイス（キャラ未選択でも可） ======
installFreeDiceHandler(client);

// ====== 起動 ======
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('環境変数 DISCORD_TOKEN を設定してね');
  process.exit(1);
}
client.login(token);

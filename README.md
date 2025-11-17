# Call-of-Cthulhu Bot (Discord)

クトゥルフ神話TRPG向けの Discord ボットです。
- 技能/能力ロール (1d100 判定)
- フリーダイス（メッセージから数式を自動判定）
- いあきゃら形式のキャラクター取り込み
- SQLite によるローカル保存 / PM2 での常駐運用を想定

---

## Requirements

- Node.js 18+ を推奨
- npm
- (開発) TypeScript

依存ライブラリは `package.json` を参照してください（例: `better-sqlite3`, `discord.js` 等）。

## Quick Start (開発)

1. リポジトリをクローン

```powershell
git clone https://github.com/MaryCache/Call-of-Cthulhu-bot.git
cd Call-of-Cthulhu-bot
```

2. 依存をインストール

```powershell
npm install
```

3. `.env` を作成して Discord トークンを設定

```
DISCORD_TOKEN=YOUR_TOKEN
```

4. 開発起動

```powershell
npm run start
# もしくは ts-node を直接使う場合:
# node -r ts-node/register/transpile-only -r dotenv/config src/index.ts
```

## Discord Bot の設定

1. Discord Developer Portal で Bot を作成
2. OAuth2 のスコープに `applications.commands` と `bot` を追加
3. Bot の権限は最小限を与えてください（メッセージ送信、インタラクションなど）
4. `Message Content Intent` を利用する場合は Developer Portal で有効化し、コード側でも `GatewayIntentBits.MessageContent` を渡してください（既に実装済み）

例: 招待 URL に必要なスコープと権限を設定して招待します。

## Production (PM2)

```powershell
pm2 start "D:/プログラミング/ptrpgbot/ecosystem.config.cjs"
pm2 ls
pm2 logs ptrpgbot
```

※ Windows 環境ではパスを適宜書き換えてください。

## データベース

ローカルに SQLite を使用します。実行時にワークスペース内に DB ファイルが作成されます（`better-sqlite3` を使用）。特別な初期化手順は不要です。

## 主なコマンド / 使い方

- `/import` — いあきゃら出力を取り込みます（長文の貼り付けが難しい場合はファイル添付を推奨）
- `/characters` — 自分のキャラ一覧を表示（ボタンで選択/削除）
- `/show` — 選択中キャラのシートを表示（自動で表示メッセージを更新）

フリーダイス（チャットで直接）:

- 例: `1d100:40`（目標付き）
- 例: `2d6+3`（四則演算対応）

技能/能力で判定（選択キャラが必要）:

- チャットに技能名や能力名を入力すると、自動でそのキャラの値を目標に判定します（例: `目星+20`）。

## トラブルシューティング

- `DISCORD_TOKEN` が設定されていない: 起動時にエラーになります。`.env` を確認してください。
- Bot が反応しない: Bot がサーバーに招待されているか、必要な権限や Intent が有効かを確認してください。
- `/import` で長文が貼れない: ファイル添付を使用してください。

## 開発・貢献

簡単なバグ修正や機能追加は Welcome です。PR を投げてください。

## ライセンス

プロジェクトに適切なライセンスを追加してください（例: MIT）。

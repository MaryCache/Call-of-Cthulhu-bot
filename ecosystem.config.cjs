// D:\プログラミング\ptrpgbot\ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "ptrpgbot",
    cwd: "D:/プログラミング/ptrpgbot",
    script: "src/index.ts",
    interpreter: "C:/Program Files/nodejs/node.exe", // 安定の絶対パス推奨
    node_args: "-r ts-node/register/transpile-only -r dotenv/config",
    env: { NODE_ENV: "production" }
  }]
};

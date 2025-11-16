// src/db.ts
import Database from 'better-sqlite3';

export const db = new Database('bot.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// スキーマ
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id   TEXT PRIMARY KEY,
  name TEXT
);

CREATE TABLE IF NOT EXISTS characters(
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT NOT NULL,
  name      TEXT NOT NULL,
  job       TEXT,
  age       INTEGER,
  sex       TEXT,
  origin    TEXT,
  icon      TEXT,
  hp        INTEGER,
  hp_max    INTEGER,
  mp        INTEGER,
  mp_max    INTEGER,
  san       INTEGER,
  san_max   INTEGER,
  db_str    TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS abilities(
  char_id INTEGER NOT NULL,
  key     TEXT NOT NULL,
  base    INTEGER NOT NULL,
  delta   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(char_id, key)
);

CREATE TABLE IF NOT EXISTS skills(
  char_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  key     TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  base    INTEGER NOT NULL,
  delta   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(char_id, key)
);

-- 選択中キャラ
CREATE TABLE IF NOT EXISTS selections(
  user_id TEXT PRIMARY KEY,
  char_id INTEGER NOT NULL
);

-- /show で貼った“ダッシュボード”メッセージ紐付け
CREATE TABLE IF NOT EXISTS panels(
  user_id    TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  PRIMARY KEY(user_id, message_id)
);
`);

// users
export const getOrCreateUser = db.prepare(
  `INSERT INTO users(id, name) VALUES(?, ?)
   ON CONFLICT(id) DO UPDATE SET name=excluded.name`
);

// characters upsert
export const upsertCharacterStmt = db.prepare(`
INSERT INTO characters(
  user_id, name, job, age, sex, origin, icon,
  hp, hp_max, mp, mp_max, san, san_max, db_str
) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(user_id, name) DO UPDATE SET
  job=excluded.job,
  age=excluded.age,
  sex=excluded.sex,
  origin=excluded.origin,
  icon=excluded.icon,
  hp=excluded.hp,
  hp_max=excluded.hp_max,
  mp=excluded.mp,
  mp_max=excluded.mp_max,
  san=excluded.san,
  san_max=excluded.san_max,
  db_str=excluded.db_str,
  updated_at=datetime('now')
`);

export const getCharByUserAndName = db.prepare(
  `SELECT * FROM characters WHERE user_id=? AND name=?`
);
export const getCharById = db.prepare(
  `SELECT * FROM characters WHERE id=?`
);
export const deleteCharacter = db.prepare(
  `DELETE FROM characters WHERE id=?`
);

// abilities
export const deleteAbilities = db.prepare(
  `DELETE FROM abilities WHERE char_id=?`
);
export const insertAbility = db.prepare(
  `INSERT INTO abilities(char_id, key, base, delta) VALUES(?, ?, ?, ?)`
);
export const listAbilities = db.prepare(
  `SELECT key, base, delta FROM abilities WHERE char_id=?`
);
export const findAbilityByKey = db.prepare(
  `SELECT key, base, delta FROM abilities WHERE char_id=? AND key=?`
);
export const addAbilityDelta = db.prepare(
  `UPDATE abilities SET delta=delta+? WHERE char_id=? AND key=?`
);
export const setAbilityDelta = db.prepare(
  `UPDATE abilities SET delta=? WHERE char_id=? AND key=?`
);

// skills
export const deleteSkills = db.prepare(
  `DELETE FROM skills WHERE char_id=?`
);
export const insertSkill = db.prepare(
  `INSERT INTO skills(char_id, section, key, aliases, base, delta) VALUES(?, ?, ?, ?, ?, ?)`
);
export const listSkills = db.prepare(
  `SELECT section, key, aliases, base, delta FROM skills WHERE char_id=? ORDER BY section`
);
export const findSkillByName = db.prepare(
  `SELECT section, key, aliases, base, delta FROM skills WHERE char_id=? AND key=?`
);
export const addSkillDelta = db.prepare(
  `UPDATE skills SET delta=delta+? WHERE char_id=? AND key=?`
);
export const setSkillDelta = db.prepare(
  `UPDATE skills SET delta=? WHERE char_id=? AND key=?`
);

// selections（選択中キャラ）
export const setSelection = db.prepare(
  `INSERT INTO selections(user_id, char_id) VALUES(?, ?)
   ON CONFLICT(user_id) DO UPDATE SET char_id=excluded.char_id`
);
export const getSelection = db.prepare(
  `SELECT char_id FROM selections WHERE user_id=?`
);
export const clearSelectionOnDelete = db.prepare(
  `DELETE FROM selections WHERE user_id=? AND char_id=?`
);

// characters の現在値更新（updated_at も更新）
export const updateCharHP = db.prepare(
  `UPDATE characters SET hp=?, updated_at=datetime('now') WHERE id=?`
);
export const updateCharMP = db.prepare(
  `UPDATE characters SET mp=?, updated_at=datetime('now') WHERE id=?`
);
export const updateCharSAN = db.prepare(
  `UPDATE characters SET san=?, updated_at=datetime('now') WHERE id=?`
);

// panels（/show メッセージ管理）
export const addPanel = db.prepare(
  `INSERT OR IGNORE INTO panels(user_id, channel_id, message_id) VALUES(?, ?, ?)`
);
export const listPanelsByUser = db.prepare(
  `SELECT channel_id, message_id FROM panels WHERE user_id=?`
);
export const removePanel = db.prepare(
  `DELETE FROM panels WHERE user_id=? AND message_id=?`
);
export const removePanelsForChannel = db.prepare(
  `DELETE FROM panels WHERE channel_id=? AND user_id=?`
);

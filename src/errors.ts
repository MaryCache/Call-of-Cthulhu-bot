// src/errors.ts

export const ERR = {
  NO_NAME: '名前が見つからないよ',
  NO_SELECTION: 'まず /characters でキャラを選択してね',
  CHAR_NOT_FOUND: '選択中のキャラが見つからないよ',
  BAD_EXPR: '式が不正だよ',
  FILE_READ_ERROR: 'ファイルを読めなかったよ',
  NO_INPUT: 'テキストかファイルのどちらかを渡してね',
} as const;

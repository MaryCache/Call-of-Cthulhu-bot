# Copilot Instructions for ptrpgbot

## Project Overview

**ptrpgbot** is a Discord bot for managing Call of Cthulhu TRPG character sheets. It enables players to import, manage, and roll dice for characters with support for skills, abilities, and SAN values.

- **Tech Stack**: TypeScript, Discord.js, better-sqlite3
- **Architecture**: Slash commands + message-based free dice rolling
- **Database**: SQLite with WAL mode for concurrent access
- **Launch**: `npm start` (runs ts-node with ts-register)

## Core Architecture

### Command System (src/commands/)
- **Pattern**: Each command is a module with `data` (SlashCommandBuilder) + `handle(interaction)` function
- **Routing**: `index.ts` imports all command modules into a `modules` object, routes via `interactionCreate` event
- **Key files**: `import.ts` (parse character text), `show.ts` (display character), `set.ts` (modify character properties), `add.ts` (add skill/ability), `skill.ts` & `ability.ts` (growth tracking)

### Data Flow
1. **Import**: `parseIaChar()` in `parser.ts` extracts character data from formatted text → stores in DB
2. **Storage**: `db.ts` manages SQLite schema (users, characters, abilities, skills, selections, panels)
3. **Display**: `render.ts` formats character data into code blocks grouped by skill section
4. **Dice Rolling**: `dice.ts` evaluates mathematical expressions with dice (supports 1d100, 2d6+5, etc. with colon notation for target comparison)

### Free Dice Handler (src/freeDice.ts)
- Parses messages matching dice patterns: `2d6+3`, `1d100:70`, `1d20 > 3`
- Triggers auto-judgment for D100 rolls (critical/success/failure/fumble)
- No character selection required—works in any channel

## Critical Patterns & Conventions

### Parser Specifics (parser.ts, types.ts)
- **Sections** (Section type): `'戦闘技能'`, `'探索技能'`, `'行動技能'`, `'交渉技能'`, `'知識技能'`
- **Abilities** (AbilityKey): STR, CON, POW, DEX, APP, SIZ, INT, EDU, IDE, 幸運, 知識
- **Aliases**: Skills can have multiple names (stored as JSON array in DB)
- **Regex patterns**: Supports both `職業：` and `職業 |` formats; full-width colons (`：`) normalized to ASCII

### Dice Engine (dice.ts)
- **RollAtom**: Represents either a number or dice roll (n×d×m) with individual roll values
- **Evaluation**: Implements Shunting Yard algorithm for mathematical expressions
- **D100 Logic**: `judgeD100(target, roll)` → 1-5 = critical, 96-100 = fumble, target >= roll = success
- **Target notation**: Colon format `2d10:15` splits expression and target; returns `target` field in result

### Database (db.ts)
- **Prepared statements**: All queries use `.prepare()` with `.run()`, `.get()`, `.all()` (never direct SQL)
- **Character selection**: `selections` table maps `user_id` → `char_id` (one active character per user)
- **Panels**: `panels` table stores message IDs for character display (supports edit updates)
- **JSON storage**: `aliases` column stores stringified arrays

### Rendering (render.ts)
- **Output format**: Multiple code blocks per character (basic info, HP/MP/SAN, abilities, skills by section)
- **Option flags**: `renderShow(charRow, { omitInitial?: boolean })` — omits skills with `delta === 0`
- **Delta tracking**: `base + delta = current value`; used for growth display

### Import Patterns
- **Always relative imports within src**: Use `./` not `./src/`
- **Error handling**: Throw user-facing error messages (caught in `index.ts` interaction handler)

## Key Developer Workflows

### Add a New Slash Command
1. Create file in `src/commands/`
2. Export `data: SlashCommandBuilder` and `handle(interaction: ChatInputCommandInteraction)`
3. Import in `index.ts`, add to `modules` object
4. Auto-registered on bot ready via `collectCommands()`

### Extend Character Attributes
1. Add DB column in `db.ts` schema
2. Update `ParsedChar` interface in `types.ts`
3. Update parser regex in `parser.ts`
4. Update relevant command files and `render.ts`

### Debug Dice Rolls
- `evalExpression()` returns `EvalResult` with `atoms` (individual rolls) and `detail` (formatted display string)
- Use `hasD100(atoms)` to detect D100 rolls before calling `judgeD100()`

## Integration Points

- **Discord.js events**: `ready`, `guildCreate`, `interactionCreate` (slash commands, buttons)
- **Character buttons** (`/characters`): Routed via `handleButton(customId, interaction)` in `commands/characters.ts`
- **Environment**: `.env` must contain `DISCORD_TOKEN`; loaded via `dotenv`
- **Process management**: `ecosystem.config.cjs` for PM2 deployment

## Common Gotchas

1. **Character selection requirement**: Most commands need active selection from `/characters`—always check before using
2. **Float values in dice**: Division produces floats; `judgeD100()` uses `<=` comparison (truncates naturally)
3. **Full-width character normalization**: Always normalize `：` → `:` in input processing
4. **Skill section names**: Must use exact Japanese strings or regex will fail

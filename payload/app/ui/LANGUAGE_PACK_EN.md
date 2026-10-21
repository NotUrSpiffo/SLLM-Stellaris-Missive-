# Making an SLLM language pack

A language pack is **a kind of addon**. It contains no code, only translation tables (JSON).
When enabled, the language appears in Settings → Interface language, and "Auto (game language)" picks it when the game language matches.

## 1. Create the template
Settings → Addons → **Create language pack template** creates `Documents\SLLM_language_pack_template`.

| File | Contents |
| --- | --- |
| `addon.json` | Addon info + the `"language"` section |
| `strings.json` | Interface strings. Key = the app's Korean source text, value = currently English |
| `patterns.json` | Strings with numbers or names, e.g. `["^편지 (\\d+)통$", "$1 letters"]` |

## 2. The "language" section of addon.json
```json
"language": {
  "code": "zh-CN",
  "name": "简体中文",
  "gameLanguage": "l_simp_chinese",
  "system": ["zh"],
  "aiLanguage": "Simplified Chinese",
  "strings": "strings.json",
  "patterns": "patterns.json"
}
```
- `code`: language code (`zh-CN`, `ja`, `pt-BR`, …). `ko` and `en` are built in and cannot be used.
- `name`: name shown in the list (in that language).
- `gameLanguage`: Stellaris language name. If the game runs in it, "Auto" picks this pack.
- `system`: Windows language prefixes to try when the game language is unknown.
- `aiLanguage`: AI reply language name (English is safest). A reply language the user set explicitly takes priority.
- `strings` / `patterns`: a JSON file path inside the addon, or the table/array written inline.

## 3. Translating
- Change **only the values** in `strings.json`. Keep the Korean keys.
- English text can also be a key, because some screens build English sentences directly.
- You can delete strings you did not translate. Missing strings show in **English**.
- Only patterns that start with `^` and end with `$` are read. Keep the `$1`, `$2` placeholders.

## 4. Installing
- Manually: Settings → Addons → Open addon folder → copy the whole folder → Reload.
- Workshop: put the same files in `sllm/addon/` inside a Stellaris mod and enable that mod in the game.

## 5. In-game text (optional)
The mod's event windows use Stellaris localisation. Copy `localisation/english/*_l_english.yml` to
`localisation/simp_chinese/*_l_simp_chinese.yml`, change the first line to `l_simp_chinese:` and translate (it can live in the same mod).

## Limits
- Text the AI writes (dialogue, newspapers, radio) follows `aiLanguage`, not the tables.
- Some status or error messages may be missing from the table. Add the English text you see on screen as a key.

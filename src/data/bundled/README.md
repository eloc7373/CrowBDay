# Bundled rules content (optional)

Put extra rules content here as `*.json` files to bundle it into the build. Each file must be an
array of rule entries, or `{ "name": "…", "notice": "…", "entries": [ … ] }`, where each entry
follows the schema in `src/board/rules/types.ts`:

```json
{
  "id": "rules/combat/opportunity-attack",
  "title": "Opportunity Attack",
  "category": "combat",
  "summary": "One or two sentences.",
  "body": "Markdown text.",
  "source": { "book": "Player's Handbook (2014)", "page": 195, "license": "Summary for personal use" },
  "tags": ["reaction"],
  "related": []
}
```

`category` is one of: combat, spellcasting, conditions, exploration, social, rest, equipment, other.

Entries with the same `id` as the built-in core rules replace them. Invalid entries are skipped and
reported in the browser console. For content you own and don't want in the build, import it in the
app instead (DM Board → Rules → Import rules JSON). It stays in your browser.

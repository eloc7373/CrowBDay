# Bundled rules content (optional)

Put SRD 5.1 (CC-BY-4.0) rules content here as `*.json` files to bundle it into the build. Each
file must be an array of rule entries, or `{ "name": "…", "notice": "…", "entries": [ … ] }`,
where each entry follows the schema in `src/board/rules/types.ts`:

```json
{
  "id": "rules/combat/opportunity-attack",
  "title": "Opportunity Attack",
  "category": "combat",
  "summary": "One or two sentences.",
  "body": "Markdown text.",
  "source": { "book": "System Reference Document 5.1", "page": 92, "license": "CC-BY-4.0" },
  "tags": ["reaction"],
  "related": []
}
```

`category` is one of: combat, spellcasting, conditions, exploration, social, rest, equipment, other.

Entries with the same `id` as the built-in sample replace it. Invalid entries are skipped and
reported in the browser console. **Do not put Player's Handbook or other copyrighted text here.**
For personal-use content you own, import it in the app instead (DM Board → Rules → Import rules
JSON). It stays in your browser and is never part of the build.

When you use SRD content, the CC-BY-4.0 licence requires attribution. Keep the `source.license`
and add the SRD attribution statement to your copy of the README.

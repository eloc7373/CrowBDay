# Personal compendium import

Open **DM Board → Monster & player options → Import JSON**. Imports are saved in the current browser's IndexedDB and do not become part of the app build. The file can contain monsters, player options, or both:

```json
{
  "name": "My personal compendium",
  "monsters": [
    {
      "name": "Example creature",
      "size": "Medium",
      "type": "beast",
      "ac": 12,
      "hp": 7,
      "speed": "30 ft.",
      "dexMod": 2,
      "conMod": 1,
      "challenge": "1/4",
      "summary": "Optional short reminder.",
      "traits": ["Optional trait or personal note."],
      "source": "My book, page 10"
    }
  ],
  "options": [
    {
      "name": "Example feature",
      "category": "feat",
      "summary": "Short reminder shown in search results.",
      "description": "Personal notes or a description for your table.",
      "source": "My book, page 20"
    }
  ]
}
```

Monsters appear in search and can be added directly to initiative. Player options can be searched and copied into a character's **Features & traits** field. Search checks names, summaries, types, traits, and descriptions. Import a corrected JSON file as another pack, then remove an older pack under **Manage imported packs**.

The import is a data loader, not a PDF converter. Keep imported book material for personal use and do not redistribute it. For SRD entries, follow the license and attribution terms of the source you use.

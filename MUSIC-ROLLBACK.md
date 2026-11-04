# Music release rollback — 2026-11-04

Restore both frontend and sadooh-api to remove the presentation pauses together.
No database schema, account, room record or player data is deleted or migrated by this release.

## Known-good baseline (free16)
- Source commit: d9873b090292ecc55a0c451687a4d4353c575dfa
- Source tree: bbf9d6f73b3c072c4b3b4308a4e59401d8a86b6e
- Site commit: 7fe43c534a2b974dbfbece4a00ddab8aa5c6754c
- Site tree: d42fee682e355994ed0839b73afe249a6b82b856
- Supabase sadooh-api: version 16, existing verify_jwt=false with handler authorization unchanged.
- Local complete source/build archive: ../sadooh-before-music-free16.zip
- Exact live Edge Function backup: ../sadooh-api-before-music16.json

Source baseline: https://github.com/marwanywr3-lab/sadooh-game/commit/d9873b090292ecc55a0c451687a4d4353c575dfa

Site baseline: https://github.com/marwanywr3-lab/sadooh-game-site/commit/7fe43c534a2b974dbfbece4a00ddab8aa5c6754c

## Restore procedure
1. Deploy the saved version-16 Edge files to the same function (preserve its existing JWT setting).
2. Create a normal new source commit using the baseline source tree, parented to current main.
3. Create a normal new site commit using the baseline site tree, parented to current main; let Pages publish it.
4. Verify live JS, health and a new match. Do not force-push or delete match data.

For audio-only concerns users can turn music off immediately in Settings without disabling card effects.
Existing rooms lacking readyAt continue safely with zero presentation pause until their next full round.

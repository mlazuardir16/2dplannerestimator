Read BUILDORA_ENGINE_SPEC.md and buildora_engine_seed.json in /docs/engine (copy this folder there first).

Task 1 — engine only, no UI changes:
1. Look at the existing repo structure and tell me which stack it uses (frontend, backend, database) before writing code.
2. Create an `engine` module in the backend language that loads the seed JSON and implements §3 of the spec exactly (volumes from template formulas, unit prices, swakelola & borongan totals, materials with packs, labor per stage/trade, schedule, price-per-m² control).
3. Add tests for every golden value in §6 (tolerance ±1 rupiah), including the edit tests.
4. Do not change the existing UI or database yet. Show me the test results when done.

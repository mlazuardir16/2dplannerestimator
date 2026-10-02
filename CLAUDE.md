# CLAUDE.md

## RAB engine (`backend/engine/`)

- The rules come from `docs/engine/`: `BUILDORA_ENGINE_SPEC.md`, `buildora_engine_seed.json` and the two reference workbooks (`Buildora_RAB_Tipe36.xlsx`, `Buildora_RAB_2Lantai_LB108.xlsx`). If the spec text and the workbooks disagree, the workbooks win, because the golden values come from them.
- The engine loads its own copy of the seed from `backend/engine/data/buildora_engine_seed.json`. Keep it in sync with the copy in `docs/engine/`.
- **The golden tests must always pass.** After any change to the engine, the seed or the calculation logic, run from `backend/`:

  ```
  .venv/bin/python -m pytest tests/test_engine.py
  ```

  The work isn't done until every test passes. Never loosen the ±Rp1 tolerance or edit the golden numbers to make a test pass. If a change would move a golden value, raise it first.
- The workbook rules the golden values depend on are written into spec §3 (v1.1): rounded effective coefficients, XII starting right after XI, and the pack tolerance. If a workbook behaviour turns out to be missing from the spec, add it there, not here.

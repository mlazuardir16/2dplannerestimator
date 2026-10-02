# CLAUDE.md

## How estimating works

- The drawing (2D planner) feeds the Buildora RAB engine.
  - `frontend/src/lib/rabInputs.js` turns the drawing into a request for the matching template: 1 floor uses `tipe36_1lantai`, 2 floors use `2lantai_lb108`, and other floor counts aren't supported.
  - Each value comes from one of three sources, in this order: a manual edit, then the drawing (`denah`), then the template default. Edits are saved on the project as `project.rab`.
- The backend `backend/rab/` exposes `GET /api/rab/templates` and `POST /api/rab/calculate`. These are pure calculations with no database access.
- The RAB screens (`frontend/src/components/rab/`) are in Indonesian. The planner UI stays in English.

## RAB engine (`backend/engine/`)

- The rules come from `docs/engine/`: `BUILDORA_ENGINE_SPEC.md`, `buildora_engine_seed.json` and the two reference workbooks (`Buildora_RAB_Tipe36.xlsx`, `Buildora_RAB_2Lantai_LB108.xlsx`). If the spec text and the workbooks disagree, the workbooks win, because the golden values come from them.
- The engine loads its own copy of the seed from `backend/engine/data/buildora_engine_seed.json`. Keep it in sync with the copy in `docs/engine/`.
- **The golden tests must always pass.** After any change to the engine, the seed or the calculation logic, run from `backend/`:

  ```
  .venv/bin/python -m pytest tests/test_engine.py
  ```

  The work isn't done until every test passes. Never loosen the ±Rp1 tolerance or edit the golden numbers to make a test pass. If a change would move a golden value, raise it first.
- Workbook rules the spec doesn't mention yet, which the golden values depend on:
  - Labour OH is rounded to 4 decimals. Material coefficient × (1 + waste) is rounded to 5 decimals.
  - Stage XII starts the week after XI ends, even if IX is still running.
  - Packs are `ceil(qty / pack_size − 0.0001)`.

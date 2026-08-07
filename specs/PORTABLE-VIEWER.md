# AppFacts portable viewer — enhancement pointer

Suite-level plan (normative for this workstream):

**[`../../x-facts/specs/PORTABLE-VIEWER-AND-FLIP.md`](../../x-facts/specs/PORTABLE-VIEWER-AND-FLIP.md)**

AppFacts already ships `/v#af1.…` ([`SPEC-af1.md`](../SPEC-af1.md), `site/v/`).

This round adds:

- Flip control: label face ↔ raw Markdown (reconstruct from compact payload; optional `raw` later)
- Copy to clipboard (raw) + optional copy link
- `?face=raw` query without breaking existing QR hashes
- Keep trust banner and link-safety rules

ModelFacts is out of scope for this round.

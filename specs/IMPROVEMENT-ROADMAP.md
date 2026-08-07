# AppFacts — improvement roadmap (from suite value assessment)

> Derived from x-facts
> [`SUITE-VALUE-AND-NETWORK-EFFECTS.md`](../../x-facts/specs/SUITE-VALUE-AND-NETWORK-EFFECTS.md).
> AppFacts is the **live proof** and cultural emitter for the family.

**Status:** planned.  
**Role in the flywheel:** Make “drop a label in the repo” normal; badges and `/v`
spread the mark; CI makes unlabeled feel incomplete.

---

## Where AppFacts stands

Live: SPEC, schema, dual generators, `/v` + flip/copy, badges, strong exemplar.
It already validates the skeleton the siblings copy.

## Gaps vs the value thesis

| Gap | Why it matters |
|---|---|
| Weak **agent entry** (`llms.txt`) | Sibling labels ship agent pointers; AppFacts still leans human/GitHub. |
| Emitter culture outside CF | Network effects need other repos emitting `APP_FACTS.md` without us. |
| Template / greenfield hooks | Standards win when scaffolds include the file by default. |
| Full-panel dogfood | Apps that ship agents should show App+Model+Agent(+Tool) together. |
| Fingerprint/`--check` awareness | Drift detection story starts with AppFacts’ existing check contract. |

## Improvements (ordered)

### Near-term

1. Add `site/llms.txt` — schema, SPEC, example, `/v` decode note; mirror ModelFacts brevity.
2. Document “agent consumption” in one short README section (frontmatter SoT).
3. Exemplar / docs CTA: open portable `/v` where a payload exists (parity with siblings).
4. Publish a **copy-paste AGENTS.md blurb**: “If `APP_FACTS.md` exists, read frontmatter first.”

### Mid-term

5. Greenfield templates (ForgeKit / CF starters) emit `APP_FACTS.md` on scaffold.
6. GitHub Action or one-liner CI example for schema validate + `--check`.
7. Badge adoption pass: make “get a badge” the default end of generate flow.
8. One public **full panel** case study repo (App + others) linked from AppFacts site.

### Later

9. Editor/agent integrations that read frontmatter (roadmap already mentioned).
10. Optional `raw` in `af1` when under URL budget (viewer already supports it).

## Roadmap phases

| Phase | Outcome | Exit |
|---|---|---|
| A | Agent discoverability | `llms.txt` live; README agent section |
| B | Emitter culture | ≥1 non-CF template emits AppFacts; CI snippet published |
| C | Virality | Badge + `/v` default in generate UX; case study panel |
| D | Family glue | Full-panel dogfood linked from site + hub essay |

## Non-goals

- Competing with SBOMs on completeness (stay curated nutrition label).
- “Certified” stack claims.
- Hosting a multi-app directory (not AppFacts’ job).

## Success signals

- Other generators/templates emit `APP_FACTS.md` without CF committing the file.
- Agents cite AppFacts schema/`llms.txt` in the wild.
- Full-panel screenshots become the default CF demo closer.

## Related

- [`PORTABLE-VIEWER.md`](./PORTABLE-VIEWER.md)
- Suite index: [`x-facts/specs/ROADMAPS.md`](../../x-facts/specs/ROADMAPS.md)

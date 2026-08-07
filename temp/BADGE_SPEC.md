# AppFacts Badge Specification — v0.1

**Status:** draft for implementation.
**Audience:** the agent(s) building badge generation into the AppFacts generators and the appfacts.dev "get a badge" page.

## Purpose

A copy-paste badge that a project can place in a site footer, nav/menu, or README, linking to that project's portable visual label at `https://appfacts.dev/v#af1.<payload>`. The badge is **self-contained**: all styling is inline on the element, so it renders correctly wherever it is pasted with **no external CSS and no external image request**. The badge reuses the existing `af1` payload (see `SPEC-af1.md`) — it introduces **no new infrastructure or endpoints** for the HTML variants.

## Design goals (normative)

1. **Self-contained.** No `<style>` block, no class dependencies, no web-font dependency, no external image for the HTML variants. Every visual property is an inline `style` attribute. The badge must look identical whether pasted into a bare page or a heavily-styled site.
2. **Style-isolated.** Each badge's root element MUST begin its inline style with `all:unset;` (then re-declare what it needs) so it does not inherit link color, underline, font, or spacing from the host page.
3. **Theme-portable.** A single tag must look correct on both light and dark backgrounds without the author choosing a variant. Achieve this by giving the badge its **own** background (a dark chip/pill), not by relying on the page background.
4. **Accessible.** The root `<a>` MUST carry an `aria-label` describing the destination (e.g. `"View this project's AppFacts label"`), because the visible text ("App Facts") does not convey that it links to a label view. Contrast of text against the badge's own background MUST meet WCAG AA (≥4.5:1 for the wordmark).
5. **Alignment-correct.** See the Alignment section below — this is the defect in the v0 preview and MUST be fixed.

## Variants

Ship three HTML variants. All link to the same `af1` URL.

| # | Name | Use | Approx. width |
|---|---|---|---|
| 1 | **Pill** | menu row, inline footer | ~110px |
| 2 | **Label + value** | README-style badge row | ~150px |
| 3 | **Mini card** | site footer with a stack summary line | ~200px |

For variant 2, the right-hand value segment is author-fillable text (default `"view label"`); generators MAY populate it with the project `type` or a short stack summary.

For variant 3, the second line is a short stack summary string (e.g. `"TypeScript · React · Postgres"`); generators SHOULD derive it from the first 2–3 `stack` values, joined with `" · "`.

## Alignment (normative — fixes the v0 defect)

**Problem in v0:** the "AF" monogram chip centered its glyphs using `line-height` equal to the chip height, while the adjacent wordmark used normal text baseline. `align-items:center` then centered the *boxes*, but the monogram's optical center did not match the wordmark's, so the chip rode visibly high — most noticeable in the mini card.

**Required approach:**

- The badge root is `display:inline-flex; align-items:center;`.
- The monogram chip is itself `display:inline-flex; align-items:center; justify-content:center;` and MUST NOT use `line-height` to vertically center its text. Its text is centered by the flex box, not by line-height.
- The chip and the wordmark are **flex siblings**; do not nest the wordmark's baseline inside a line-height-driven box.
- Set the chip's `font-size` and dimensions so its optical center matches the wordmark. Recommended baseline values (tune during implementation against a rendered screenshot):
  - Pill/label chip: `width:14px; height:14px; border-radius:3px; font-size:8px; font-weight:800;`
  - Mini-card chip: `width:26px; height:26px; border-radius:6px; font-size:11px; font-weight:800;`
- Give the chip a **small optical nudge only if a rendered check still shows misalignment** — prefer `align-self:center` correctness over magic-number `margin-top`. If a nudge is unavoidable, use `transform:translateY(...)` with a documented value, not `position:relative;top:`.
- For the mini card specifically: the chip must center against the **two-line text block as a whole**, so the text lines live in a single `display:inline-flex; flex-direction:column; justify-content:center;` sibling, and the row uses `align-items:center`. This is what makes the chip sit at the vertical midpoint of both lines rather than the midpoint of the first line.

**Acceptance:** render each variant and confirm the monogram's optical center aligns with (a) the wordmark cap-height midline for pill/label, and (b) the two-line block's vertical center for the mini card. Verify at 100% and 200% zoom.

## Payload & link (normative)

- Link target: `https://appfacts.dev/v#af1.<payload>` where `<payload>` is exactly the `af1` fragment defined in `SPEC-af1.md`. The badge does not define its own encoding.
- The badge MUST NOT embed any project data beyond what is already in the `af1` payload and the (optional) human-visible summary text. No secrets, no analytics parameters.
- `target`/`rel`: the root `<a>` SHOULD open in the same tab by default. If a generator emits a `target="_blank"` option, it MUST also emit `rel="noopener"`.

## Color tokens (recommended, not required)

| Token | Value | Use |
|---|---|---|
| Badge background | `#0f1115` | pill / left segment |
| Wordmark text | `#e7ecf2` | |
| Accent | `#3ecf9a` | monogram chip bg, value segment bg |
| Accent ink | `#052018` | text on accent |
| Border (on light) | `rgba(0,0,0,.12)` | |
| Border (on dark) | `#2a323e` | |

Generators MAY expose an accent override; if so, they MUST re-check contrast for the accent-ink text and fall back to a safe ink color when contrast drops below AA.

## Markdown / README variant (separate track — requires an endpoint)

The three variants above are **HTML+CSS** and render fully only where inline styles survive. **GitHub READMEs strip inline styles**, so those badges will not render there. Supporting README placement requires the standard image-link pattern:

```
[![AppFacts](https://appfacts.dev/badge.svg?af1=<payload>)](https://appfacts.dev/v#af1.<payload>)
```

This needs a **hosted badge-image endpoint** — out of scope for the self-contained HTML work, tracked separately:

- **Endpoint:** `GET https://appfacts.dev/badge.svg?af1=<payload>` → returns an SVG badge (pill or label+value style) with correct `Content-Type: image/svg+xml` and cache headers.
- **Stateless:** the SVG is rendered purely from the `af1` payload in the query string; no storage.
- **Rendering parity:** the SVG should visually match the HTML pill/label variants (same tokens, same alignment rules — note SVG uses `dominant-baseline`/`text-anchor` for centering, so the alignment fix is expressed differently but must reach the same result).
- **Optional style param:** `&style=pill|shield` to choose form; default `shield` (README convention).
- **Security:** validate/limit `af1` length; reject payloads over the documented `af1` size ceiling; never reflect raw input into the SVG without escaping.

If README support is a priority, prioritize this endpoint; if footer/menu is the priority, the HTML variants alone suffice.

## Generator integration (normative)

- Add a way to emit the badge snippet alongside `APP_FACTS.md` — e.g. a `--badge[=pill|label|card]` flag that prints the ready-to-paste HTML with the project's real `af1` payload already substituted, and (when the endpoint exists) the Markdown image-link form.
- The emitted snippet MUST be the final, payload-substituted markup — never a template with `YOUR_PAYLOAD` left in.
- The generator SHOULD also write the chosen snippet into a `## Badge` section of a `BADGE.md` or into the generator's stdout, documented in the generator README.
- Keep the HTML snippet output byte-identical to the appfacts.dev "get a badge" page output for the same payload, so there is one canonical badge markup.

## Acceptance criteria (roll-up)

- [ ] Three HTML variants, each fully inline-styled, each opening with `all:unset;`.
- [ ] Each renders correctly on light AND dark backgrounds from a single tag.
- [ ] Alignment fix implemented per the Alignment section; verified against rendered output at 100% and 200% zoom, including the mini-card two-line case.
- [ ] Root `<a>` has an `aria-label`; wordmark meets AA contrast on the badge's own background.
- [ ] Link targets the `af1` URL from `SPEC-af1.md`; no extra data or tracking params.
- [ ] Generator emits payload-substituted snippets (no `YOUR_PAYLOAD` placeholder in output).
- [ ] appfacts.dev "get a badge" page and generator output produce identical markup for the same payload.
- [ ] (If prioritized) `badge.svg` endpoint returns a stateless, escaped, size-limited SVG matching the HTML variants.

## Revision history

| Version | Notes |
|---|---|
| **0.1** | Initial badge spec: three self-contained HTML variants, alignment fix, accessibility + theme-portability requirements, `af1` link reuse, generator `--badge` integration, and a separate hosted `badge.svg` track for README/Markdown support. |

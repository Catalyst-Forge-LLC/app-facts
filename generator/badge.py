"""Canonical AppFacts HTML badge snippets (BADGE_SPEC.md).

Keep byte-identical with generator/badge.js and site/badge.
"""

from __future__ import annotations

from typing import Any, Mapping


def esc_html(s: Any) -> str:
    """Match generator/badge.js escHtml (do not use html.escape — quote rules differ)."""
    t = str(s if s is not None else "")
    return (
        t.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def stack_summary_line(stack: Any, max_n: int = 3) -> str:
    if not isinstance(stack, Mapping):
        return ""
    vals: list[str] = []
    for v in stack.values():
        if v is None:
            continue
        t = str(v).strip()
        if not t or t.lower() == "unknown":
            continue
        vals.append(t)
        if len(vals) >= max_n:
            break
    return " · ".join(vals)


def label_value_text(fm: Mapping[str, Any] | None) -> str:
    if not fm:
        return "view label"
    t = str(fm.get("type") or "").strip()
    if t and len(t) <= 40 and t.lower() != "unknown":
        return t
    return "view label"


def render_badge_html(
    variant: str,
    viewer_url: str,
    *,
    value_text: str | None = None,
    stack_line: str | None = None,
    type: str | None = None,
    stack: Mapping[str, Any] | None = None,
) -> str:
    href = esc_html(viewer_url)
    aria = 'aria-label="View this project\'s AppFacts label"'
    fm = {"type": type, "stack": stack}

    if variant == "pill":
        return (
            f'<a href="{href}"\n'
            f'   style="all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:7px;\n'
            f'   font:600 12px/1 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;\n'
            f'   padding:6px 11px;border-radius:999px;background:#0f1115;color:#e7ecf2;\n'
            f'   border:1px solid #2a323e;text-decoration:none;vertical-align:middle;"\n'
            f"   {aria}>\n"
            f"  <span style=\"display:inline-flex;align-items:center;justify-content:center;\n"
            f"    width:14px;height:14px;border-radius:3px;flex:none;background:#3ecf9a;color:#052018;\n"
            f'    font:800 8px ui-monospace,monospace;">AF</span>\n'
            f"  <span>App&nbsp;Facts</span>\n"
            f"</a>"
        )

    if variant == "label":
        raw = value_text if value_text is not None else label_value_text(fm)
        value = esc_html(raw).replace(" ", "&nbsp;")
        return (
            f'<a href="{href}"\n'
            f'   style="all:unset;cursor:pointer;display:inline-flex;align-items:stretch;\n'
            f'   font:600 12px/1 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;\n'
            f"   border-radius:6px;overflow:hidden;text-decoration:none;vertical-align:middle;\n"
            f'   border:1px solid rgba(0,0,0,.12);"\n'
            f"   {aria}>\n"
            f'  <span style="display:inline-flex;align-items:center;gap:5px;background:#0f1115;\n'
            f'    color:#e7ecf2;padding:6px 9px;">\n'
            f"    <span style=\"display:inline-flex;align-items:center;justify-content:center;\n"
            f"      width:13px;height:13px;border-radius:3px;flex:none;\n"
            f'      background:#3ecf9a;color:#052018;font:800 8px ui-monospace,monospace;">AF</span>App&nbsp;Facts</span>\n'
            f'  <span style="display:inline-flex;align-items:center;background:#3ecf9a;\n'
            f'    color:#052018;padding:6px 10px;font-weight:700;">{value}</span>\n'
            f"</a>"
        )

    if variant == "card":
        line_raw = stack_line if stack_line is not None else (stack_summary_line(stack) or "stack label")
        line = esc_html(line_raw)
        return (
            f'<a href="{href}"\n'
            f'   style="all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:10px;\n'
            f"   font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;\n"
            f"   padding:10px 13px;border-radius:10px;background:#12151b;\n"
            f'   border:1px solid #262e3a;text-decoration:none;vertical-align:middle;"\n'
            f"   {aria}>\n"
            f"  <span style=\"display:inline-flex;align-items:center;justify-content:center;\n"
            f"    width:26px;height:26px;border-radius:6px;flex:none;\n"
            f'    background:#3ecf9a;color:#052018;font:800 11px ui-monospace,monospace;">AF</span>\n'
            f'  <span style="display:inline-flex;flex-direction:column;justify-content:center;gap:2px;">\n'
            f'    <span style="color:#e7ecf2;font-weight:700;font-size:12px;line-height:1.1;">App Facts</span>\n'
            f'    <span style="color:#8b94a3;font-weight:500;font-size:10.5px;line-height:1.1;">{line}</span>\n'
            f"  </span>\n"
            f"</a>"
        )

    raise ValueError(f"Unknown badge variant: {variant} (use pill|label|card)")


def render_badge_markdown(
    viewer_url: str,
    *,
    type: str | None = None,
    stack: Mapping[str, Any] | None = None,
) -> str:
    html = render_badge_html("pill", viewer_url, type=type, stack=stack)
    label = render_badge_html("label", viewer_url, type=type, stack=stack)
    card = render_badge_html("card", viewer_url, type=type, stack=stack)
    return (
        "# AppFacts badge\n\n"
        "Self-contained HTML (paste into a site footer or nav). "
        "Links to the portable label. GitHub README strips inline styles — "
        "use a hosted SVG badge when that endpoint ships.\n\n"
        f"## Pill\n\n{html}\n\n"
        f"## Label + value\n\n{label}\n\n"
        f"## Mini card\n\n{card}\n"
    )

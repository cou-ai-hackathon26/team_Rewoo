# Figma handoff — BanglaShield Home V11

**Destination:** Existing design file `Yt51P1WXFgSaYUFDRrtsKX`.

**Live Figma status:** connection established, but the Starter-plan MCP tool call limit prevented the actual edit. No Figma frames were changed.

## Frames

- `Homepage / Desktop / 1440` — use `desktop.png` as **reference only**.
- `Homepage / Mobile / 390` — use `mobile.png` as **reference only**.
- `Homepage / Component primitives` — create reusable verification cards, CTA pills, example tabs, message bubbles, Guardian mark, section labels.

**Important:** Build Figma from editable native layers, not a screenshot flattened inside a frame. Reuse existing published colors and typography when available. The screenshot is a layout target only.

## Page anatomy

1. Use the existing global website header. The standalone HTML header is only a preview.
2. Hero: centralized bilingual vision statement with a restrained emerald highlight and two primary destinations.
3. Animated Guardian illustration: soft concentric safety orbits, original shield check icon, connector ends and two evidence cards. No green ribbon, copied mascot or competitor mark.
4. Three accessible demo tabs: voice, message and link. This is explicit sample UI, never a live detection feed.
5. Four verification doors: voice, message, image, link/QR (reusable component instances).
6. Guardian story section: copy and illustration of helpful dialogue, labeled as an example.
7. Rahela scenario: large narrative typography and a fictional phone message.
8. Supporting products: ScamAcademy, moderated community, recovery assistance.
9. Final CTA: quiet, decisive, reassuring.

## Color psychology, not manipulation

- Forest `#15352A`: stability, seriousness, trustworthy grounding.
- Emerald `#1E8957`: positive action and direction, never a promise of perfect protection.
- Mint `#EAF6EE`: calm, spacious context.
- Clay `#A95A47`: warning used sparingly, accompanied by words and icons.
- Ivory `#F7FAF5`: comfort and high reading contrast.

## Interaction specs

- Pill hover/press: translateY(-2px), 200ms ease.
- Card hover: translateY(-5px), 220ms ease with low-key shadow.
- Guard halo: ~9s subtle drift, **purely decorative**.
- Demo selection: selected tab contrast changes + content replacement, no fabricated spinner or model call.
- Accessibility: focus-visible outline, native buttons, tab semantics, 320px layout, `prefers-reduced-motion` disables motion.
- Every displayed sample is explicitly fictional and never scored numerically.

## Implementation mapping

Use `HomePageV11.tsx` to replace only `src/components/shield/pages/home.tsx`; add `home-v11.css` beside it. The existing `Header`, `Footer`, `MobileTabBar`, router, Guardian, analysis APIs and all other backend components must remain untouched.

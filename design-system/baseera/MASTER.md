# بصيرة — Design System Master

> **Source of truth:** Use this file for every page. Page-specific design rules may live under `design-system/baseera/pages/` only where an explicit page exception is needed.

**Product:** Arabic reading, comprehension and numeracy learning space for primary-school children, with parent/teacher support.  
**Design intelligence:** UI UX Pro Max — Kids Learning + Educational App.  
**Visual direction:** Softened Claymorphism combined with colorful block-based learning cards, clear hierarchy, calm backgrounds, and restrained motion.

## Product intent

- Make children feel welcome, capable and unhurried. Celebrate attempts and progress rather than ranking children or using frightening risk labels.
- Design Arabic-first with correct RTL layout, readable Arabic shaping, short instructions, and visible labels.
- Separate child activities from adult/teacher reporting. Institutional login is available but visually secondary.
- This is an educational screening and support tool, not a medical diagnostic product.
- Keep the homepage's interactive preview titled **محاكاة جلسة القراءة التفاعلية**. It may highlight a word and play its pronunciation, but must not imply that camera tracking, gaze fixation, calibration or gaze maps are part of the product.
- Never create speeds, scores or reassuring status labels when the supporting evidence is unavailable. Present missing measures as unavailable.
- Use Lucide icons consistently; do not use emoji as interface icons.
- No advertisements, pressure timers, manipulative streaks, shame-oriented wording, or child-targeted upsells.

## Color palette

| Role | Hex | Use |
|---|---|---|
| Primary | `#2563EB` | Main actions, active navigation, links |
| Primary hover | `#1D4ED8` | Hover/pressed primary state |
| On primary | `#FFFFFF` | Text/icons on blue actions |
| Teal | `#0F766E` | Listening and supportive learning actions |
| Achievement yellow | `#F59E0B` | Reward accents with dark text |
| Play pink | `#EC4899` | Decorative highlights only; use dark text on pale pink surfaces |
| Default canvas | `#EFF6FF` | Calm light-blue background |
| Card | `#FFFFFF` | Main content surfaces |
| Ink | `#17243D` | Headings and main copy |
| Supporting text | `#475569` | Secondary copy |
| Border | `#D6E4F8` | Card outlines and dividers |
| Soft blue | `#DBEAFE` | Selected/active states |
| Soft mint | `#D1FAE5` | Supportive callouts |
| Soft yellow | `#FEF3C7` | Reward/number activities |
| Soft pink | `#FCE7F3` | Decorative accent surface |
| Error | `#B91C1C` | Clear error text and icons |

Maintain at least 4.5:1 contrast for normal text. Use dark text on yellow and pink surfaces. Color alone must never encode a result; pair it with clear wording and/or an icon.

## Typography

- **Primary:** Noto Sans Arabic, weights 400–900.
- **Fallback:** Tahoma, Arial, sans-serif.
- Use a comfortable 16px minimum for mobile body text and approximately 1.65–1.9 line-height for Arabic reading copy.
- Headings may use 800–900 weight; keep normal paragraphs calm and easy to scan.
- Do not use decorative Latin display fonts that do not include complete Arabic glyphs.

## Shape, spacing and depth

- Keep an 8px spacing rhythm: 8 / 16 / 24 / 32 / 48 / 64px.
- Cards: 22–28px radius, soft border and restrained layered shadow.
- Primary controls: minimum 44px height. Inputs: minimum 48px height and 16px font size.
- Keep 8px or more between adjacent touch targets.
- Use soft color blocks and gentle depth; avoid excessive gradients, nested cards, glass effects and high-frequency motion.
- Each page should have one clear primary action. Secondary actions should remain visually subordinate.
- On small screens, use a five-item bottom navigation and reserve safe-area space. Prevent unintentional horizontal page scrolling.

## Motion

- Motion should be short, calm and purposeful. The reading preview may highlight one word at a time and must have a pause control.
- Respect `prefers-reduced-motion`; no essential information may rely on animation.
- Do not animate multiple elements continuously or place moving patterns behind reading text.

## Accessibility and responsive rules

- Correct RTL, semantic heading hierarchy and a skip-to-content link.
- Visible focus indicators; keyboard-usable controls and descriptive accessible names.
- Use visible field labels and inline error messages; never rely on placeholders alone.
- Keep primary/body text readable in both light and night reading themes.
- Essential information must not exist only in tiny labels. Wrap labels when needed instead of truncating them.
- Test widths around 375px, 768px and desktop widths; support portrait, landscape and browser zoom.
- Preserve the reading comfort controls and spacing controls while redesigning the pages around them.

## Shared components

- Header: wordmark, five child-facing destinations, teacher access as a secondary action.
- Mobile navigation: Home, Reading, Math, Accessible Reader, Practice (five items maximum).
- Primary action: filled blue with white text, rounded corners and clear press/disabled states.
- Secondary action: card surface, soft border and dark text.
- Activity tile: large icon tile, direct label, one-sentence explanation, visible action.
- Data summary: measured educational indicators only; missing data shown as unavailable.
- Parent/teacher panel: evidence-aware descriptions and non-diagnostic wording.
- Footer: learning purpose, privacy and parent/teacher entry.

## Avoid

- Camera/gaze/calibration claims or visualizations.
- Labels like “طفل سليم” or “عسر قراءة مرتفع” presented as a diagnosis.
- Fake defaults, unsupported precision, or zero standing in for missing evidence without an explicit explanation.
- Tiny grey copy, low-contrast buttons, icon-only navigation without labels, emoji icons, autoplay that cannot be paused, and distracting animations.

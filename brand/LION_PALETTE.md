# Lion Wallet — color palette

Derived from [BRANDING.md](../BRANDING.md) and hues in [`lion.svg`](./lion.svg): savanna warmth, amber gold accent, deep mane neutrals.

## Core brand

| Token | Hex | Role |
|--------|-----|------|
| **Amber gold** | `#D97706` | Primary accent, CTAs, links, focus |
| **Amber deep** | `#B45309` | Hover / pressed accent |
| **Amber bright** | `#FBBF24` | Highlights, small accents |
| **Amber wash** | `#FFEDD5` | Selected rows, info banners (`accent-light`) |
| **Mane brown** | `#44311D` | Wordmark / print (optional; UI primary text uses ink) |
| **Savanna cream** | `#FEF3C7` | Warm highlights |
| **Parchment** | `#FFFBEB` | Near-white warm background |
| **Lion cream white** | `#FFFCF8` | Card / surface (matches icon `#FEFCF8` family) |

## From `lion.svg` (reference)

| Hex | Use in artwork |
|-----|----------------|
| `#261911` → `#715A44` | Icon background gradient (`lw-bg`) |
| `#FEFCF8` | Light fills, corner highlights |
| `#F0CB95`, `#DC994E`, `#E9AF69` | Mane / face warmth |
| `#7A6249`, `#533E26` | Mid / deep fur detail |

## Surfaces (dark UI — future dark mode / marketing)

| Token | Hex | Role |
|--------|-----|------|
| **Savanna night** | `#3D291C` | Elevated panels |
| **Mane black** | `#120C08` | Deepest background |
| **Mane ink** | `#2C1810` | Body text on light UI; secondary on dark |

## Optional modern accent (from BRANDING)

Use sparingly for “chain/tech” moments so the product still reads **Lion**.

| Token | Hex | Role |
|--------|-----|------|
| **Indigo** | `#6366F1` | Optional secondary accent (not default in popup) |

## App UI (`src/popup/styles/globals.css` `@theme`)

Popup uses Tailwind semantic colors — edit the `@theme` block, not one-off hex in components.

| Tailwind token | Hex | Role |
|----------------|-----|------|
| `base` | `#F2EBE2` | App chrome background |
| `surface` | `#FFFCF8` | Cards, inputs |
| `elevated` | `#FFFFFF` | Modals / popovers |
| `divider` | `#E5DCD2` | Hairlines, secondary buttons |
| `divider-strong` | `#D4C9BC` | Secondary button hover |
| `text-primary` | `#2C1810` | Primary copy |
| `text-secondary` | `#715A44` | Secondary copy |
| `text-tertiary` | `#9C8B7A` | Hints, disabled |
| `accent` | `#D97706` | Primary actions, links |
| `accent-hover` | `#B45309` | Pressed / hover |
| `accent-light` | `#FFEDD5` | Info banner, selection wash |
| `accent-foreground` | `#FFFFFF` | Text on accent buttons |
| `success` | `#34C759` | Success / strong password |
| `danger` | `#DC2626` | Errors, destructive |
| `danger-hover` | `#B91C1C` | Destructive hover |
| `warning` | `#EA580C` | Strength meter “fair” |
| `warning-bg` / `warning-text` | `#FFF7ED` / `#C2410C` | Warning banners |

## Legacy CSS variables (reference only)

```css
:root {
  --lion-amber: #d97706;
  --lion-amber-deep: #b45309;
  --lion-amber-bright: #fbbf24;
  --lion-mane: #44311d;
  --lion-cream: #fef3c7;
  --lion-parchment: #fffbeb;
  --lion-night: #3d291c;
  --lion-void: #120c08;
  --lion-ink: #2c1810;
  --lion-indigo: #6366f1;
}
```

## Assets

| File | Use |
|------|-----|
| **[lion.svg](./lion.svg)** | **App / Dock / AppIcon** — full-color lion (1024×1024). |
| **[lion-paw-toolbar.svg](./lion-paw-toolbar.svg)** | **Extension + toolbar** — bold paw silhouette on warm dark ground (512×512). Easier to read at 16–48px. |
| [lion-wallet-icon.svg](./lion-wallet-icon.svg) | Legacy hand-drawn mark (optional) |
| [lion-wallet-symbol.svg](./lion-wallet-symbol.svg) | Symbol-only variant for docs or UI (optional) |

Run `pnpm icons` after editing either `lion.svg` or `lion-paw-toolbar.svg`.

## Accessibility

- Pair **amber** (`#D97706`) with **white or near-black** for text; avoid amber-on-cream for small type (contrast too low).
- On `#120C08`, prefer **cream or amber-bright** for primary text/icons; use **amber** for large headlines only if contrast checked (WCAG AA).

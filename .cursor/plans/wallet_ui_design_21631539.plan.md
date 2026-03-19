---
name: Wallet UI Design
overview: Design and implement all wallet popup UI pages as a standalone Preact app with Tailwind CSS, runnable via Vite dev server with mock data — no extension APIs required.
todos:
  - id: scaffold-ui
    content: "Project scaffold: init npm, configure Vite + Preact + Tailwind v4 + TypeScript, tailwind theme with custom palette/fonts, globals.css, verify vite dev serves popup"
    status: in_progress
  - id: design-tokens
    content: "Design tokens and Tailwind config: define color palette, font families (system + JetBrains Mono), spacing scale, border-radius tokens, shadow definitions"
    status: pending
  - id: components
    content: "Build shared component library: Button, Input, Card, Header, AddressDisplay, Identicon, TokenRow, NetworkBadge, Tabs, Banner, Spinner, CopyButton, BottomActions, Modal"
    status: pending
  - id: mock-state
    content: "Mock state system: create signals-based mock wallet state, fake data (addresses, balances, tokens, networks), DevToolbar component for state switching"
    status: pending
  - id: onboarding-pages
    content: "Onboarding pages: Welcome, SetPassword, SeedPhrase (with grid), ConfirmSeed (interactive word selection), ImportWallet (with tab toggle)"
    status: pending
  - id: core-pages
    content: "Core pages: Unlock, Home (balance + tokens + quick actions), Send (form + review), Receive (QR + copy)"
    status: pending
  - id: approval-pages
    content: "Approval pages: TxApproval (transaction details + confirm/reject), SignMessage (message display + sign/reject)"
    status: pending
  - id: settings-pages
    content: "Settings and network: Settings page (accounts, security, lock), NetworkSelector modal (search, list, custom add)"
    status: pending
  - id: animations-polish
    content: "Animations and polish: page transitions, button press feedback, copy animation, shake on error, modal transitions, loading states"
    status: pending
isProject: false
---

# Wallet UI Design and Implementation

## Standalone Dev Setup

The UI will run as a plain Preact SPA via `vite dev` — no Safari extension, no background scripts. A mock state provider will simulate all wallet operations (unlock, balances, signing requests) so every page and flow can be previewed in a browser at `localhost:5173`.

- Frame the app in a centered 360x600px container to simulate the Safari extension popup
- Hash-based routing (`preact-router`) to navigate between pages
- A floating dev toolbar (bottom) to jump between states: locked, onboarding, home, approval

## Tech Stack

- **Preact** + **preact-router** + **@preact/signals** (reactive state, ~1KB)
- **Tailwind CSS v4** (utility-first, PurgeCSS built in for tiny production bundle)
- **Lucide Preact** icons (tree-shakeable, consistent stroke style)
- **@noble/hashes** (for identicon generation — deterministic color from address)
- System font stack (`-apple-system, BlinkMacSystemFont, ...`) for body text
- **JetBrains Mono** (via Google Fonts) for addresses, balances, and numeric values
- `qrcode` package for receive QR generation

## Design System

### Color Palette

```
Background:
  base:        #F2F2F7    (macOS system grouped background)
  surface:     #FFFFFF    (cards, inputs)
  elevated:    #FFFFFF    (modals, dropdowns, with shadow)
  divider:     #E5E5EA

Text:
  primary:     #1C1C1E
  secondary:   #8E8E93
  tertiary:    #AEAEB2

Accent:
  DEFAULT:     #6366F1    (indigo — primary brand color)
  hover:       #4F46E5
  light:       #EEF2FF    (backgrounds, badges)
  foreground:  #FFFFFF    (text on accent buttons)

Semantic:
  success:     #34C759
  danger:      #FF3B30
  warning:     #FF9500
```

Indigo (#6366F1) is the accent — distinctive from MetaMask (orange), Coinbase (blue), Rabby (teal). It reads as crypto-native and technical while blending with macOS system chrome.

### Typography

```
Font family:
  body:    -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif
  mono:    "JetBrains Mono", "SF Mono", ui-monospace, monospace

Scale (Tailwind defaults):
  xs:      12px   (labels, captions)
  sm:      14px   (secondary text, token rows)
  base:    16px   (body, inputs)
  lg:      18px   (section headers)
  xl:      20px   (page titles)
  3xl:     30px   (balance display)
```

### Spacing & Layout

- Popup container: **360px wide, max 600px tall**
- Page padding: 16px horizontal
- Card border-radius: 12px
- Button border-radius: 10px
- Element spacing: 8px / 12px / 16px rhythm
- Cards: white surface, no border, subtle `shadow-sm`

### Component Library

Build these shared components first:

| Component        | Description                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`         | Variants: primary (indigo fill), secondary (gray fill), ghost (transparent), danger (red). Sizes: sm, md, lg. Loading state with spinner. |
| `Input`          | Text/password input with label, optional error, optional right-slot (paste/max button). Mono font variant for addresses.                  |
| `Card`           | White rounded surface with optional header and padding.                                                                                   |
| `Header`         | Top bar: optional back arrow, centered title, optional right action icon.                                                                 |
| `AddressDisplay` | Truncated address (`0x1234...abcd`) in mono font + copy button.                                                                           |
| `Identicon`      | Deterministic colored circle generated from address bytes.                                                                                |
| `TokenRow`       | Token icon placeholder + name + balance (mono) + USD value.                                                                               |
| `NetworkBadge`   | Colored dot + chain name, clickable.                                                                                                      |
| `Tabs`           | Horizontal tab toggle (e.g., Mnemonic / Private Key).                                                                                     |
| `Banner`         | Info/warning/danger banner with icon and text.                                                                                            |
| `Spinner`        | Animated indigo spinner, sm/md sizes.                                                                                                     |
| `CopyButton`     | Icon button that shows checkmark briefly after copy.                                                                                      |
| `BottomActions`  | Sticky bottom area with 1-2 action buttons (for approval screens).                                                                        |

## Pages

### 1. Welcome (first launch)

```
+----------------------------------+
|                                  |
|           [Wallet Icon]          |
|                                  |
|       Safari EVM Wallet          |
|    Your keys. Your crypto.       |
|                                  |
|   +--[Create New Wallet]------+  |
|                                  |
|   +--[Import Existing]--------+  |
|                                  |
+----------------------------------+
```

- Centered vertically in popup
- Wallet icon: simple geometric/shield shape in indigo
- "Create New Wallet" = primary button, "Import Existing" = secondary button
- Subtle indigo gradient glow behind the icon

### 2. Set Password

```
+----------------------------------+
|  <- Back         Set Password    |
|----------------------------------|
|                                  |
|  Create a password to encrypt    |
|  your wallet on this device.     |
|                                  |
|  Password                        |
|  +----------------------------+  |
|  | ••••••••           [show]  |  |
|  +----------------------------+  |
|                                  |
|  Confirm Password                |
|  +----------------------------+  |
|  | ••••••••           [show]  |  |
|  +----------------------------+  |
|  [strength indicator bar]        |
|                                  |
|  +--[Continue]----------------+  |
+----------------------------------+
```

- Password strength indicator: thin bar below confirm, colored (red/yellow/green)
- Show/hide toggle in each input
- Button disabled until passwords match and meet minimum length

### 3. Recovery Phrase (create flow)

```
+----------------------------------+
|  <- Back      Recovery Phrase    |
|----------------------------------|
|  [!] Write down these 12 words   |
|      in order. Store safely.     |
|----------------------------------|
|                                  |
|  +------+ +------+ +------+     |
|  |1 word| |2 word| |3 word|     |
|  +------+ +------+ +------+     |
|  |4 word| |5 word| |6 word|     |
|  +------+ +------+ +------+     |
|  |7 word| |8 word| |9 word|     |
|  +------+ +------+ +------+     |
|  |10 wrd| |11 wrd| |12 wrd|    |
|  +------+ +------+ +------+     |
|                                  |
|        [Copy to clipboard]       |
|                                  |
|  [x] I saved my recovery phrase  |
|  +--[Continue]----------------+  |
+----------------------------------+
```

- Words in mono font, numbered, on `bg-base` rounded chips
- Warning banner at top (amber)
- Copy button is ghost/secondary
- Continue disabled until checkbox is checked

### 4. Confirm Recovery Phrase

```
+----------------------------------+
|  <- Back      Confirm Phrase     |
|----------------------------------|
|  Tap the words in the correct    |
|  order to verify your backup.    |
|                                  |
|  +-----+ +-----+ +-----+        |
|  | 1.  | | 2.  | | 3.  |  ...   |
|  +-----+ +-----+ +-----+        |
|  (empty slots to fill)           |
|                                  |
|  +-apple-+ +-grape-+ +-cat-+    |
|  +-dog--+  +-echo-+  +-fox-+    |
|  +-golf-+  +-hat--+  +-ice-+    |
|  (shuffled word chips)           |
|                                  |
|  +--[Verify & Finish]---------+ |
+----------------------------------+
```

- Top area: ordered slots that fill as user taps words
- Bottom area: shuffled word chips, each disappears when tapped
- Wrong order: shake animation + reset
- Correct: success state, button activates

### 5. Import Wallet

```
+----------------------------------+
|  <- Back       Import Wallet     |
|----------------------------------|
|                                  |
|  [  Mnemonic  |  Private Key  ]  |
|                                  |
|  (if Mnemonic tab):              |
|  +----------------------------+  |
|  | Enter your 12 or 24 word  |  |
|  | recovery phrase...         |  |
|  |                            |  |
|  +----------------------------+  |
|                                  |
|  (if Private Key tab):           |
|  +----------------------------+  |
|  | 0x...                      |  |
|  +----------------------------+  |
|                                  |
|  +--[Import]------------------+  |
+----------------------------------+
```

- Tab toggle component at top (indigo active tab)
- Mnemonic: multi-line textarea, mono font
- Private key: single-line input, mono font, with paste button
- Validation: show error inline if invalid

### 6. Unlock

```
+----------------------------------+
|                                  |
|           [Wallet Icon]          |
|                                  |
|  +----------------------------+  |
|  | ••••••••                   |  |
|  +----------------------------+  |
|                                  |
|  +--[Unlock]------------------+  |
|                                  |
|  Forgot password? Import again   |
+----------------------------------+
```

- Minimal, vertically centered
- Auto-focus on password input
- Enter key submits
- Wrong password: input shakes, red error
- "Import again" is a subtle text link

### 7. Home / Dashboard (main screen)

```
+----------------------------------+
|  [NetworkBadge v]         [gear] |
|----------------------------------|
|                                  |
|  [Identicon]                     |
|  0x1a2B...9fCd  [copy]          |
|                                  |
|        3.4521 ETH                |
|        $8,234.12                 |
|                                  |
|   [^ Send]       [v Receive]    |
|                                  |
|------ Tokens --------------------|
|  [E] Ethereum        3.4521 ETH |
|                       $8,234.12  |
|  [U] USDC          1,200.00     |
|                       $1,200.00  |
|  [~] Uniswap          45.2 UNI  |
|                         $312.50  |
+----------------------------------+
```

- **Network badge** top-left: colored dot + "Ethereum" — tappable, opens network selector
- **Settings gear** top-right
- **Account block**: identicon circle (40px), truncated address in mono, copy button
- **Balance**: large 3xl mono font for ETH, sm secondary text for USD
- **Quick actions**: two pill-shaped buttons side-by-side, with up/down arrow icons
- **Token list**: scrollable, each row is a `TokenRow` — icon, name, balance (mono), USD value
- Connected dApp indicator: small green dot near address if connected

### 8. Send

```
+----------------------------------+
|  <- Back              Send       |
|----------------------------------|
|  To                              |
|  +----------------------------+  |
|  | 0x...              [paste] |  |
|  +----------------------------+  |
|                                  |
|  Amount            [ETH v]       |
|  +----------------------------+  |
|  | 0.0               [MAX]   |  |
|  +----------------------------+  |
|  ~ $0.00 USD                    |
|                                  |
|  Network fee    ~$2.40           |
|  Estimated time  ~12 sec         |
|                                  |
|  +--[Review Transaction]------+  |
+----------------------------------+
```

- Address input: mono font, paste button, validates checksum
- Token selector: dropdown to choose ETH or ERC-20
- Amount: large input, MAX fills available balance
- USD conversion updates live
- Fee estimate shown before review
- Review opens a confirmation step (reuse approval layout)

### 9. Receive

```
+----------------------------------+
|  <- Back            Receive      |
|----------------------------------|
|                                  |
|  +----------------------------+  |
|  |                            |  |
|  |        [QR CODE]           |  |
|  |                            |  |
|  +----------------------------+  |
|                                  |
|  0x1a2B3c4D5e6F...7a8B9fCd     |
|                                  |
|  +--[Copy Address]------------+  |
|                                  |
|  [NetworkBadge] Ethereum         |
+----------------------------------+
```

- QR code: generated from full address, large, centered
- Full address in mono below QR
- Copy button (primary style)
- Network badge at bottom so user knows which chain

### 10. Transaction Approval (dApp popup)

```
+----------------------------------+
|         Transaction Request      |
|----------------------------------|
|  [favicon] app.uniswap.org      |
|----------------------------------|
|                                  |
|  Sending                         |
|  +----------------------------+  |
|  | 0.5 ETH (~$1,215.00)      |  |
|  | To: 0x7a16...3fB2          |  |
|  +----------------------------+  |
|                                  |
|  Details                    [v]  |
|  +----------------------------+  |
|  | Gas Limit: 21000           |  |
|  | Max Fee:  32 gwei          |  |
|  | Data: 0x... (expandable)   |  |
|  +----------------------------+  |
|                                  |
|  Estimated fee        ~$2.40     |
|                                  |
|  [  Reject  ]   [== Confirm ==]  |
+----------------------------------+
```

- Origin banner with favicon + domain (so user knows which site)
- Value prominently displayed with USD conversion
- Expandable details section for gas/data
- Two-button bottom bar: Reject (secondary) / Confirm (primary)
- For contract interactions: show method name if decodable

### 11. Message Signing (dApp popup)

```
+----------------------------------+
|         Signature Request        |
|----------------------------------|
|  [favicon] opensea.io           |
|----------------------------------|
|                                  |
|  This site is requesting your    |
|  signature.                      |
|                                  |
|  Message:                        |
|  +----------------------------+  |
|  | Sign in to OpenSea         |  |
|  | Nonce: 8a3f2b...           |  |
|  | (scrollable content)       |  |
|  +----------------------------+  |
|                                  |
|  Signing with                    |
|  [id] 0x1a2B...9fCd             |
|                                  |
|  [  Reject  ]   [== Sign ==]    |
+----------------------------------+
```

- Similar layout to TX approval
- Message content in scrollable mono-font card
- Shows which account will sign
- For EIP-712 typed data: render as structured key-value pairs

### 12. Settings

```
+----------------------------------+
|  <- Back            Settings     |
|----------------------------------|
|                                  |
|  Accounts                        |
|  +----------------------------+  |
|  | [id] Account 1   0x1a..Cd |  |
|  | [id] Account 2   0x8f..2B |  |
|  | [+ Add Account]           |  |
|  +----------------------------+  |
|                                  |
|  Network                         |
|  +----------------------------+  |
|  | [dot] Ethereum Mainnet   > |  |
|  +----------------------------+  |
|                                  |
|  Security                        |
|  +----------------------------+  |
|  | Auto-lock timer          > |  |
|  | Export Private Key        > |  |
|  | Show Recovery Phrase      > |  |
|  +----------------------------+  |
|                                  |
|  +--[Lock Wallet]-----------+   |
+----------------------------------+
```

- Grouped card sections (iOS Settings-style)
- Account rows with identicon + name + truncated address
- Chevron for drill-down items
- Lock Wallet button at bottom (danger/ghost style)

### 13. Network Selector (overlay/modal)

```
+----------------------------------+
|        Select Network      [x]  |
|----------------------------------|
|  +----------------------------+  |
|  | Search networks...         |  |
|  +----------------------------+  |
|                                  |
|  [*] Ethereum Mainnet       [v] |
|  [ ] Polygon                    |
|  [ ] Arbitrum One               |
|  [ ] Optimism                   |
|  [ ] Base                       |
|  [ ] BSC                        |
|  [ ] Avalanche                  |
|  [ ] Sepolia (testnet)          |
|                                  |
|  [+ Add Custom Network]         |
+----------------------------------+
```

- Modal overlay with backdrop blur
- Search/filter input at top
- Active network has indigo checkmark
- Each row: colored dot unique to chain + name
- Add custom at bottom opens a form

## File Structure

```
src/
├── popup/
│   ├── index.html
│   ├── main.tsx                  # Preact entry, mounts App
│   ├── App.tsx                   # Router + state provider
│   ├── mock/
│   │   ├── state.ts              # Mock wallet state (signals)
│   │   ├── data.ts               # Fake addresses, balances, tokens
│   │   └── DevToolbar.tsx        # Dev-only nav to switch states
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Header.tsx
│   │   ├── AddressDisplay.tsx
│   │   ├── Identicon.tsx
│   │   ├── TokenRow.tsx
│   │   ├── NetworkBadge.tsx
│   │   ├── Tabs.tsx
│   │   ├── Banner.tsx
│   │   ├── Spinner.tsx
│   │   ├── CopyButton.tsx
│   │   ├── BottomActions.tsx
│   │   └── Modal.tsx
│   ├── pages/
│   │   ├── Welcome.tsx
│   │   ├── SetPassword.tsx
│   │   ├── SeedPhrase.tsx
│   │   ├── ConfirmSeed.tsx
│   │   ├── ImportWallet.tsx
│   │   ├── Unlock.tsx
│   │   ├── Home.tsx
│   │   ├── Send.tsx
│   │   ├── Receive.tsx
│   │   ├── TxApproval.tsx
│   │   ├── SignMessage.tsx
│   │   ├── Settings.tsx
│   │   └── NetworkSelector.tsx
│   └── styles/
│       └── globals.css           # Tailwind directives + custom props
├── tailwind.config.ts            # Custom theme (colors, fonts)
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## Interactions and Animations

- **Page transitions**: subtle 150ms slide-left/right for navigation (CSS `transform + opacity`)
- **Button press**: scale(0.97) on `:active`
- **Copy feedback**: icon swap to checkmark for 1.5s
- **Wrong password**: input shake (CSS keyframe, 300ms)
- **Seed word tap**: gentle scale bounce on selection
- **Modal**: fade-in backdrop + slide-up content (200ms)
- **Loading**: indigo spinner, pulsing dots for balance fetching
- All animations via CSS transitions/keyframes — no JS animation library

## Dev Toolbar (development only)

A fixed bar at the very bottom of the 360x600 frame with small buttons to:

- Switch state: `Onboarding → Locked → Home → Approval`
- Toggle network (to test network badge variants)
- Simulate incoming dApp request (TX approval, sign message)
- Reset state

This toolbar is excluded from production builds via `import.meta.env.DEV` guards.

# Contributing to Lion Wallet

Thanks for your interest in contributing. Lion Wallet is a small, focused project — contributions that align with its [philosophy](./PHILOSOPHY.md) are welcome.

## Getting Started

```bash
git clone <repo-url>
cd safari-evm-wallet
pnpm install
pnpm dev          # Vite dev server for popup UI
pnpm build        # type-check + build extension to dist/
```

### Safari testing

```bash
pnpm build:safari    # build extension + Xcode project
pnpm run:safari      # build + launch the app
```

Enable the extension in Safari > Settings > Extensions.

## Project Structure

```
src/
  background/      Service worker: wallet core, vault, RPC, signing, approvals
  content/         Content script: page ↔ background bridge
  inpage/          Injected provider: window.ethereum (EIP-1193/6963)
  popup/           Preact UI: pages, components, store
  shared/          Types, constants, message definitions, formatters
scripts/           Build + icon generation
xcode/             Safari Web Extension Xcode project
```

## Code Style

- **Linter:** Biome — run `pnpm lint` to check, `pnpm lint:fix` to auto-fix
- **Type checking:** `pnpm typecheck` (uses tsgo)
- **Package manager:** pnpm only
- See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for project-specific conventions

## Before Submitting a PR

1. Run `pnpm lint` and `pnpm typecheck` — both must pass
2. Test the extension in Safari if your change touches background/content/inpage code
3. Keep commits focused — one logical change per commit
4. Don't add new dependencies without discussion. Every dependency is a liability (see philosophy, principle 3)

## What Makes a Good Contribution

- Bug fixes with clear reproduction steps
- Performance improvements with before/after measurements
- New chain support (add to `constants.ts`, follow existing pattern)
- Transaction decoding improvements
- Accessibility improvements
- Security hardening

## What Will Likely Be Declined

- Built-in swap/bridge/staking features (Lion Wallet connects to dApps, it doesn't replace them)
- Analytics, telemetry, or tracking of any kind
- Heavy dependencies that increase bundle size without clear justification
- UI changes that add complexity without clear user benefit

## Reporting Bugs

Open a GitHub issue with:

- Browser and OS version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

For security vulnerabilities, see [SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under GPL-3.0, the same license as the project.

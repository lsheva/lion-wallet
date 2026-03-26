# This is a style guide for the AI and user contributions to follow. Please update it when AI interacts with user and user suggests a better pattern to do certain things. Do not edit previous entries, append only. Make rules detailed but abstracted enough to be applied to different contexts.

- avoid unhandled errors, always show a user-friendly error message, in some cases show a console.log message
- try not using array.find when accessing by id or other fields, use mapping instead
- always check package.json for existing scripts, try to not reinvent the wheel. Update package.json when new scripts are added.
- Use tsgo instead of tsc for type checking and compilation.
- all contract addresses should have a copy button to copy the address to the clipboard
- button should always have type="button". Avoid <div rel="button">. Use <button type="button"> instead.
- use pnpm as package manager
- avoid magic numbers in constants if possible, generate them using library from structured data (for event signatures, etc)
- do not hardcode EVM function selectors (e.g. raw `0x…` four-byte values). Derive them with viem’s `toFunctionSelector` from the human-readable signature, or export a single shared constant next to the ABI (e.g. `ERC20_TRANSFER_SELECTOR` in `abis.ts`) and import that everywhere calldata is inspected or compared.
- persist user-facing Ethereum addresses in checksummed form: use viem `getAddress` when writing to storage or comparing canonical form; migrate existing lowercase entries on read if needed.
- for SolidJS `<Show when={…}>`, when the child needs a value that is only valid when the condition is truthy (e.g. optional `recipient()`), put the truthy value last in the `when` expression and use the `keyed` prop so the callback receives the narrowed value—avoid `recipient() ?? ""` or other fake defaults inside the branch.
- “recent recipient” caches should only record addresses that are real transfer destinations (plain native sends and ERC-20 `transfer` recipients decoded from calldata), not arbitrary contract `to` targets from other interactions.

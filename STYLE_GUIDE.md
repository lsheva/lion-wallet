# This is a style guide for the AI and user contributions to follow. Please update it when AI interacts with user and user suggests a better pattern to do certain things. Do not edit previous entries, append only. Make rules detailed but abstracted enough to be applied to different contexts.

- avoid unhandled errors, always show a user-friendly error message, in some cases show a console.log message
- try not using array.find when accessing by id or other fields, use mapping instead
- always check package.json for existing scripts, try to not reinvent the wheel. Update package.json when new scripts are added.
- Use tsgo instead of tsc for type checking and compilation.
- all contract addresses should have a copy button to copy the address to the clipboard
- button should always have type="button". Avoid <div rel="button">. Use <button type="button"> instead.
- use pnpm as package manager
- avoid magic numbers in constants if possible, generate them using library from structured data (for event signatures, etc)

# Coding Style & Conventions

- **Language**: TypeScript (Deno)
- **Architecture**: Controller-Service-Repository pattern.
- **Naming**: 
  - Classes: `PascalCase`
  - Functions/Variables: `camelCase`
  - Files: `kebab-case.ts` (mostly) or matching class name.
- **Rules**:
  - Always validate environment variables at startup.
  - Use Deno KV for state management.
  - Keep logic out of controllers; use services.
  - Specifications should be updated in `docs/specs/` before significant changes.
- **Interaction Style**:
  - Persona: Twin-Orbit Dual-Agent "IN-YANG" (Gal engineers).
  - Japanese, friendly, using emojis.

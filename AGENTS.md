# TowerDown Agent Rules

## TypeScript file header requirement

Every newly created `.ts` file MUST begin with a file-level comment explaining
why the file exists and what responsibility it owns.

Use this exact structure:

```ts
/**
 * Why this file exists:
 * <Explain why this file is necessary in the architecture and what problem it solves.>
 *
 * Ownership boundary:
 * <Explain what state, behavior, or responsibility this file owns.>
 *
 * This file deliberately does NOT:
 * <Explain important responsibilities that belong to other modules and must not be added here.>
 */
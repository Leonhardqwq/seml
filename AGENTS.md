# AGENTS.md

## Project Overview

VS Code extension for **SEML** (Survival Endless Markup Language) — a domain-specific language for describing PvZ Survival Endless wave strategies. The extension provides syntax highlighting, parsing `.seml` files to JSON, and running simulation tests (smash, explode, refresh, pogo) via native binaries.

- **Language**: TypeScript (strict mode)
- **Runtime**: VS Code Extension Host (Node.js, CommonJS modules)
- **Target**: ES2021

## Build / Lint / Test Commands

```bash
# Compile TypeScript → out/
npm run compile        # tsc -p ./

# Watch mode
npm run watch          # tsc -watch -p ./

# Lint
npm run lint           # eslint src --ext ts

# Run all tests (must compile first)
npm run compile && npm test   # mocha out/test/**/*.test.js

# Run a single test file
npm run compile && npx mocha out/test/suite/parser.test.js

# Run a single test by name pattern
npm run compile && npx mocha out/test/suite/parser.test.js --grep "should parse valid wave"

# Test coverage
npm run coverage       # nyc --reporter=lcov --reporter=text-summary npm test
```

**Important**: Tests run against compiled JS in `out/`, not TypeScript source. Always `npm run compile` before running tests.

## Project Structure

```
src/
  extension.ts        # VS Code extension entry point (activate/deactivate)
  parser.ts           # Core SEML parser (~977 lines, main logic)
  error.ts            # Custom Error type and helpers
  string.ts           # String utilities (chopPrefix, parseNatural, levenshtein)
  plant_types.ts      # PlantType enum (hex values from PvZ Emulator)
  zombie_types.ts     # ZombieType enum + CN/EN abbreviation mappings
  templates.ts        # SEML template strings for each test type
  test/
    mocha.opts         # Mocha config (ts-node, recursive, 15s timeout)
    suite/
      parser.test.ts   # Parser unit tests (Mocha + Chai)
syntaxes/
  seml.tmLanguage.json # TextMate grammar for syntax highlighting
out/                   # Compiled JS output (gitignored: no)
```

## Code Style

### Formatting

- **Indentation**: Tabs (not spaces)
- **Semicolons**: Required (enforced by `@typescript-eslint/semi`)
- **Curly braces**: Required for all control flow (`curly: warn`)
- **Equality**: Strict equality only (`eqeqeq: warn`)
- **Line endings**: CRLF (Windows project)

### Imports

Order: Node builtins, then VS Code API, then local modules.

```typescript
// Node builtins — namespace import style
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Local modules — named imports with relative paths
import { isError } from './error';
import { parse } from './parser';
import { PlantType } from './plant_types';
```

### Naming Conventions

Enforced by `@typescript-eslint/naming-convention: warn`.

| Construct      | Convention  | Example                        |
|---------------|-------------|--------------------------------|
| Functions     | camelCase   | `parseCob`, `parseWave`        |
| Variables     | camelCase   | `waveLength`, `prevWaveNum`    |
| Types         | PascalCase  | `ParserOutput`, `ProtectPos`   |
| Enums         | PascalCase  | `PlantType`, `ZombieType`      |
| Enum members  | camelCase   | `cherryBomb`, `gargantuar`     |
| Constants     | camelCase   | `acceptableZombieTypes`        |
| Type fields   | camelCase   | `readonly waveLength: number`  |

Use `/* eslint-disable @typescript-eslint/naming-convention */` only for data-mapping objects where keys must match external formats (e.g., `bannedZombieTypes` with scene keys like `"DE"`, `"NE"`).

### Type Definitions

- Use `type` (not `interface`) for data structures
- Mark all fields `readonly` on data types
- Use discriminated unions with a literal `op` field for action variants
- Use string literal unions for small enums: `type Fodder = "Normal" | "Puff" | "Pot"`
- Use numeric `enum` for game constants (hex values): `enum PlantType { cherryBomb = 0x2 }`

```typescript
// Discriminated union pattern used throughout
type Cob = {
    readonly op: "Cob";
    readonly time: number;
    readonly positions: Position[];
};

type FixedCard = {
    readonly op: "FixedCard";
    readonly time: number;
    readonly plantType: PlantType;
    readonly position: Position;
};

type Action = Cob | FixedCard | SmartCard | FixedFodder | SmartFodder;
```

### Error Handling

**Critical**: This project uses a custom error-as-value pattern. Errors are **returned**, never thrown.

```typescript
// Custom Error type (src/error.ts)
type Error = { type: "Error", lineNum: number, msg: string, src: string };

// Create errors with the factory function
return error(lineNum, "波数应为正整数", waveNumToken);

// Check results with type guard
const result = parseWave(out, lineNum, line);
if (isError(result)) {
    return result;  // propagate error up
}
```

- `error()` creates an Error object with line number, message (Chinese), and source token
- `isError()` is the type guard — checks `result?.type === "Error"`
- Parser functions return `null` on success, `Error` on failure
- Parse functions that produce values return `T | Error`
- **Never** use `throw` for parse errors — always return via the `error()` factory
- **Never** use `no-throw-literal` exceptions (ESLint rule enforced)

### TypeScript Strictness

All strict flags are enabled in `tsconfig.json`:

- `strict: true`, `alwaysStrict: true`
- `noImplicitAny`, `noImplicitReturns`, `noImplicitThis`
- `noFallthroughCasesInSwitch`
- `noUnusedLocals`, `noUnusedParameters`
- `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`
- `useUnknownInCatchVariables` — catch variable is `unknown`, not `any`

**Do not** suppress type errors with `as any`, `@ts-ignore`, or `@ts-expect-error`.

### Function Patterns

- Parser functions take `(out: ParserOutput, lineNum: number, line: string)` and mutate `out`
- Helper parsing functions are often nested inside the calling function as closures
- Token parsing: split line by space, destructure tokens, validate each independently
- Non-null assertions (`!`) are used after array indexing when bounds are already validated

### Testing

- **Framework**: Mocha (BDD style) + Chai assertions
- **Structure**: `describe()` per parser function, `it()` per case
- **Naming**: `it("should ...")` in English
- Test both success paths (return `null`, check mutations on `out`) and error paths (return `error(...)`)
- Use `deep.equal` for object comparisons, `.equal(null)` for success checks
- Each `describe` block has a `beforeEach` that resets state

```typescript
describe("parseCob", () => {
    let out: ParserOutput;
    beforeEach(() => {
        out = { setting: {}, waves: [] };
    });

    it("should return an error if no wave is set", () => {
        expect(parseCob(out, 1, "P 300 2 9", 1)).to.deep.equal(
            error(1, "请先设定波次", "P 300 2 9")
        );
    });

    it("should add a Cob action to the current wave", () => {
        out.waves[0] = { waveLength: 601, iceTimes: [], actions: [] };
        expect(parseCob(out, 1, "P 300 2 9", 1)).equal(null);
        expect(out.waves[0]!.actions).to.deep.equal([...]);
    });
});
```

### UI Messages

All user-facing messages are in **Chinese**. Error messages include the line number and source token. Follow existing message patterns when adding new ones.

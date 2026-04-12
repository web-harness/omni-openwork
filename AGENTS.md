# Agent Guidelines

- [Agent Guidelines](#agent-guidelines)
  - [Core Principles](#core-principles)
  - [Implementation Principles](#implementation-principles)
  - [Overview](#overview)
  - [Build and Test](#build-and-test)
  - [Architecture](#architecture)
  - [Code Conventions](#code-conventions)
  - [Critical Files](#critical-files)
  - [Gotchas](#gotchas)
  - [Links](#links)

## Core Principles

- You are forbidden to do "stop-and-ask behavior". Go until instructions are 100% exhausted and finished.
- Do not introduce new direct `window` usage unless it matches an existing repo-approved interop boundary.
- Do not introduce new direct `document` usage unless it matches an existing repo-approved interop boundary.
- Do not add new custom event systems or hacks to achieve your goals.
- You are not allowed to use RequestAnimationFrame, setTimeout, setInterval, queueMicrotask or any other shortcuts to achieve your goals.
- You are only allowed to use the official React APIs, concepts and features to achieve your goals
- You are strictly forbidden from doubting the React APIs, concepts and features. If you think something is missing, you are to make it yourself using React APIs, concepts and features. You are not allowed to doubt the React team or their decisions. They know best.
- Follow repo's README.md for general project information.
- Backwards compatibility and defensive programming is forbidden, until asked explicitly by the user.
- Do not debug Vite tooling or build orchestration unless the user explicitly asks for that. Focus on your code and let the existing tooling rebuild. Browser verification of your code is allowed and expected when needed.
- Ad-hoc scripts are strictly forbidden.

## Implementation Principles

When implementing plans:

- Continue until 100% completion. No interrupts.
- Keep code simple and easy to reason about
- Avoid excess commenting
- Test in your browser tool
- No hacks or workarounds
- Do. Not. Stop. Until. 100%.
- Stay true to the plan.
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

## Overview

Electron desktop app wrapping **deepagentsjs** + **LangGraph agents**. Two build targets: Electron (desktop) and Web (browser with shims).

## Build and Test

```bash
npm install          # Install dependencies
npm run dev          # Start Electron dev server
npm run build        # Typecheck + production build
npm run lint         # ESLint (linting)
npm run format       # ESLint (formatting)
npm run typecheck    # TypeScript validation (node + web configs)
npm run web:dev      # Browser-only dev server (no Electron)
```

## Architecture

```
src/
├── main/           # Electron main process
│   ├── agent/      # deepagents runtime, LocalSandbox, system prompts
│   ├── checkpointer/  # sql.js checkpoint saver for LangGraph
│   ├── db/         # SQLite via sql.js (WebAssembly)
│   ├── ipc/        # IPC handlers: agent, threads, models, settings
│   └── services/   # Title generation, workspace watching
├── preload/        # Context bridge (window.api)
└── renderer/       # React UI
    └── src/
        ├── components/
        │   ├── chat/    # Chat interface, streaming markdown
        │   ├── panels/  # Todo, filesystem, subagent panels
        │   ├── tabs/    # File viewers (PDF, DOCX, code, etc.)
        │   └── ui/      # shadcn primitives
        └── lib/         # Zustand store, electron-transport, utils
web/
├── shims/          # Browser polyfills (electron, fs, child_process)
└── main.ts         # Web entry point with ZenFS initialization
```

**Key patterns:**

- IPC channels follow `domain:action` naming (e.g., `threads:create`, `agent:invoke`)
- Agent streaming via dedicated channel per thread: `agent:stream:${threadId}`
- Thread-scoped checkpoints prevent cross-thread state corruption
- Web build uses ZenFS (IndexedDB) for virtual filesystem

## Code Conventions

**TypeScript**: Strict mode, no `any`. Interfaces for object shapes.

**React**: Functional components, named exports, `cn()` for conditional classes.

**State management**:

- App-level: Zustand store in `lib/store.ts`
- Thread-level: `ThreadProvider` context in `lib/thread-context.tsx`
- Streaming: `useStream()` from @langchain/langgraph-sdk with custom `ElectronIPCTransport`

**Design system**: Tactical/SCADA theme. See CONTRIBUTING.md for color tokens.

- Dark background (`#0D0D0F`), status colors (critical/warning/nominal/info)
- JetBrains Mono font, 4px spacing increments, 3px border radius

**Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)

## Critical Files

| Purpose                | Location                                     |
| ---------------------- | -------------------------------------------- |
| Agent runtime          | `src/main/agent/runtime.ts`                  |
| IPC streaming          | `src/main/ipc/agent.ts`                      |
| Checkpoint persistence | `src/main/checkpointer/sqljs-saver.ts`       |
| Preload API            | `src/preload/index.ts`                       |
| Renderer transport     | `src/renderer/src/lib/electron-transport.ts` |
| Zustand store          | `src/renderer/src/lib/store.ts`              |

## Gotchas

- **Web build limitations**: No real subprocess execution; `child_process` is simulated. localStorage ~5MB limit.
- **IPC mixing**: Uses both `handle()` (request-response) and `on()/send()` (streaming push).
- **Abort before stream**: Always abort existing agent streams before starting new ones to prevent checkpoint corruption.
- **ZenFS initialization**: Web mode must await `initializeFS()` before any file operations.

## Links

- [CONTRIBUTING.md](CONTRIBUTING.md) — Development setup, design system tokens, PR process
- [README.md](README.md) — Quick start, supported providers

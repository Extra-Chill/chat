# Extra Chill Chat

Generic frontend Gutenberg chat block for WordPress.

## Vision

`extra-chill/chat` is a shared chat UI primitive for WordPress.

The goal is to provide a **standard, frontend-first, dumb chat block** that can power multiple chat experiences cleanly across different plugins and products.

This repo should focus on the **best chat experience possible** while leaving backend-specific concerns to adapters and consuming plugins.

## Why This Exists

There are already multiple chat block implementations across different repos, including:

- `Extra-Chill/extrachill-chat`
- `Sarai-Chinwag/spawn`

Those implementations overlap heavily in UI and runtime behavior, but differ in backend details like:

- authentication
- session management
- billing / credits
- agent transport
- provisioning / availability states
- branding

This repo exists to separate the **shared chat experience** from the **product-specific business logic**.

## Goals

- Build a reusable Gutenberg chat block
- Keep the block frontend-focused and presentation-first
- Support multiple backend implementations through adapters
- Standardize chat UX across Extra Chill projects
- Make it easy for WordPress plugins to become AI-native without rebuilding chat UI every time

## Non-Goals

- Owning backend AI orchestration
- Owning product-specific business logic
- Owning billing, provisioning, or auth policy
- Becoming a monolithic app plugin

## Proposed Architecture

```text
WordPress Plugin
    |
    |  server-rendered wrapper + config
    v
Shared Chat Block UI
    |
    |  adapter contract
    v
Backend-specific implementation
```

### Core idea

The shared block should own:

- message list rendering
- composer UX
- loading / error / retry states
- scrolling behavior
- streaming display
- session list UI (when enabled)
- accessibility and keyboard interactions
- mobile and responsive behavior

The consuming plugin should own:

- REST endpoints
- authentication
- pricing / credit logic
- agent lifecycle
- account state
- server availability logic
- branding and product-specific rules

## Adapter Model

The main abstraction in this repo should be a narrow adapter contract.

Example shape:

```ts
interface ChatAdapter {
  capabilities: {
    sessions: boolean
    history: boolean
    streaming: boolean
    tools: boolean
    availabilityStates: boolean
  }

  loadInitialState?(): Promise<InitialState>
  listSessions?(): Promise<Session[]>
  loadMessages?(sessionId: string): Promise<Message[]>
  createSession?(): Promise<Session>
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>
  clearSession?(sessionId: string): Promise<void>
}
```

This keeps the UI generic while allowing:

- `extrachill-chat` to use WordPress REST endpoints
- `spawn` to use its own gateway / session model
- future implementations to plug in without forking the UI

## Initial Priorities

1. Define the adapter API and normalized state model
2. Build a minimal frontend-only chat block shell
3. Support a basic message flow end-to-end
4. Add optional session sidebar support
5. Port one real consumer first (`extrachill-chat` is likely the easiest)
6. Port `spawn` after the core boundaries are proven

## Migration Strategy

### Phase 1
- create core shared block
- define types and adapter interfaces
- implement minimal mount + send + render loop

### Phase 2
- adapt `extrachill-chat` to use shared UI
- validate API shape and message model

### Phase 3
- adapt `spawn`
- support richer session and availability states

### Phase 4
- refine styling, streaming, markdown, and extensibility

## Repo Status

This repo is currently in the **concept / planning** stage.

Implementation should start only after the core abstractions are clear enough that we do not just move duplication into a new place.

## Roadmap

See GitHub issues for the initial roadmap.

## Related Repositories

- https://github.com/Extra-Chill/extrachill-chat
- https://github.com/Sarai-Chinwag/spawn

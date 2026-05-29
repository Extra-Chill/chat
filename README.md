# @extrachill/chat

React chat UI components with a built-in REST API client. Speaks the standard chat message format natively — no adapters, no wrappers.

## Install

```bash
npm install @extrachill/chat
```

## Quick Start

```tsx
import { Chat } from '@extrachill/chat';
import '@extrachill/chat/css';
import apiFetch from '@wordpress/api-fetch';

function StudioChat() {
  return (
    <Chat
      basePath="/datamachine/v1/chat"
      fetchFn={apiFetch}
      agentId={5}
    />
  );
}
```

## What's Included

**Components** — `Chat`, `ChatMessages`, `ChatMessage`, `ChatInput`, `TypingIndicator`, `ToolMessage`, `SessionSwitcher`, `ErrorBoundary`, `AvailabilityGate`

**Hook** — `useChat` manages messages, sessions, multi-turn continuation loops, and availability state

**API client** — `sendMessage`, `continueResponse`, `listSessions`, `loadSession`, `deleteSession`

**Normalizer** — `normalizeMessage`, `normalizeConversation`, `normalizeSession` for mapping raw backend messages into the UI model

**CSS** — `@extrachill/chat/css` provides base styles with 30+ CSS custom properties (`--ec-chat-*`) for theming

## REST Contract

The package expects these endpoints at `basePath`:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/` | Send a message (creates or continues session) |
| `POST` | `/continue` | Continue a multi-turn response |
| `GET` | `/sessions` | List sessions for the current user |
| `GET` | `/{session_id}` | Load a single session's conversation |
| `DELETE` | `/{session_id}` | Delete a session |

Any backend implementing this contract works. The `fetchFn` prop accepts any function matching `(options: { path, method?, data? }) => Promise<json>` — `@wordpress/api-fetch` works directly.

## Theming

Override CSS custom properties on `.ec-chat` to match your design system:

```css
.my-chat .ec-chat {
  --ec-chat-user-bg: var(--accent);
  --ec-chat-assistant-bg: var(--card-background);
  --ec-chat-font-family: var(--font-family-body);
  --ec-chat-border-radius: var(--border-radius-md);
}
```

## Message Suggestions

Pass `messageSuggestions` to offer optional prompt starters on fresh conversations. Selecting one sends its `message`, or its `label` when `message` is omitted.

```tsx
<Chat
  basePath="/datamachine/v1/chat"
  fetchFn={apiFetch}
  messageSuggestions={[
    {
      label: 'Plan my homepage',
      message: 'Help me plan the homepage for my site.',
      description: 'Start with goals and sections',
    },
    {
      label: 'Write an about page',
      message: 'Help me draft a friendly about page.',
    },
  ]}
/>
```

## Long-Running Turns

Backends that support long-running chat turns can opt into stop and queue UI without changing the default behavior. When no capability is provided, the input is disabled while a response is loading, matching earlier releases.

```tsx
<Chat
  basePath="/chat"
  fetchFn={fetchChatJson}
  initialSessionId="session-123"
  runCapabilities={{ cancel: true, queue: true }}
  activeRunId={activeRunId}
  onCancelRun={async ({ runId, sessionId }) => {
    await cancelRun({ runId, sessionId });
  }}
  onQueueMessage={async ({ sessionId, content, files }) => {
    await queueMessage({ sessionId, content, files });
  }}
/>
```

Capability behavior:

- No support: input and message suggestions stay disabled while loading.
- Cancel support: a stop control appears while loading once both `activeRunId` and `sessionId` are available.
- Queue support: input and message suggestions stay usable while loading and submitted messages render optimistically with a queued state.
- Cancel + queue support: both controls are enabled together.

If a backend returns run IDs in response metadata, adapters can expose them generically through `getRunId`:

```tsx
<Chat
  basePath="/chat"
  fetchFn={fetchChatJson}
  runCapabilities={{ cancel: true }}
  getRunId={(metadata) => typeof metadata.run_id === 'string' ? metadata.run_id : null}
  onCancelRun={cancelRun}
/>
```

## Consumers

- **extrachill-studio** — Studio Chat tab (agent_id=5)
- **extrachill-roadie** — Portable floating agent chat
- **data-machine** — Admin chat sidebar

## License

GPL-2.0-or-later

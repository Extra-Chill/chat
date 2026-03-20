# Changelog

## 0.2.0

- **BREAKING:** Remove `ChatAdapter` interface and adapter pattern
- Package now speaks the standard chat REST API contract natively
- Add `api.ts` — built-in REST client (`sendMessage`, `continueResponse`, `listSessions`, `loadSession`, `deleteSession`)
- Add `normalizer.ts` — maps raw backend messages to `ChatMessage` format
- Add `types/api.ts` — typed REST request/response shapes
- `useChat` hook now takes `basePath`, `fetchFn`, and `agentId` instead of an adapter
- `Chat` component props updated: `basePath` + `fetchFn` + `agentId` replace `adapter`
- Add `showSessions` prop to `Chat` for optional session switcher
- `showTools` defaults to `true` (was `false`)
- Export API functions and normalizer for advanced use cases
- Remove `ChatCapabilities`, `SendMessageInput`, `SendMessageResult`, `ContinueResult`, `StreamChunk` types

## 0.1.0

- Initial release
- Adapter contract (`ChatAdapter` interface) with capability flags
- Normalized message model (`ChatMessage`, `ChatSession`, `ChatAvailability`)
- Core components: `ChatMessages`, `ChatMessage`, `ChatInput`, `TypingIndicator`, `ToolMessage`, `SessionSwitcher`, `ErrorBoundary`
- `useChat` hook — core state orchestrator with adapter integration
- Base CSS styles

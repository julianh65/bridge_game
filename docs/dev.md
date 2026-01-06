# Local development

## Web UI (Vite)
- Start the web app:
  - `npm run dev:web`
- Open `http://localhost:5173`.
- Hot reload: edits in `apps/web/src` refresh automatically (Vite HMR).
- Use the view toggle in the top nav to switch between Lobby/Game/Board Debug.

## PartyKit server (room prototype)
- Start the PartyKit dev server:
  - `npm run dev:server`
- Default dev port is `1999` (PartyKit CLI output shows the active URL).
- PartyKit dev watches for changes and reloads on save.

## Engine tests
- Run once:
  - `npm run test`
- Watch mode:
  - `npm run test:watch`

## Typecheck/lint
- Typecheck:
  - `npm run typecheck`
- Lint:
  - `npm run lint`

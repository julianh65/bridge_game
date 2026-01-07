# Local development

## Web UI (Vite)
- Start the web app:
  - `npm run dev:web`
- Open `http://localhost:5173`.
- Hot reload: edits in `apps/web/src` refresh automatically (Vite HMR).
- Use the view toggle in the top nav to switch between Play/Board Debug/Cards.
- Play mode connects to PartyKit rooms via the Home screen.

## PartyKit server (room prototype)
- Start the PartyKit dev server:
  - `npm run dev:server`
- Default dev port is `1999` (PartyKit CLI output shows the active URL).
- PartyKit dev watches for changes and reloads on save.
- Each browser profile stores a rejoin token per room. To simulate multiple seats,
  use different browsers or an incognito window (otherwise you reconnect as the same seat).

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

## Owner-only TODOs (Julian - not for agents, do later)
- Replace placeholder faction symbols with final icons once art is ready (not a current task).
  - Add icon files to `apps/web/public/factions/` named by faction id, e.g. `bastion.svg`.
  - Update `apps/web/src/lib/factions.ts` to include an `iconSrc` (or swap `symbol` usage) per faction.
  - Swap UI renderers in `apps/web/src/components/PreGameLobby.tsx`, `apps/web/src/components/Lobby.tsx`,
    `apps/web/src/components/VictoryScreen.tsx`, and `apps/web/src/components/BoardView.tsx` to use the icon.
  - Keep the `.faction-symbol` sizing class as the consistent 18/16/14px container; update CSS if icons
    need different sizing or padding.

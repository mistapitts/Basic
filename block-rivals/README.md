# Block Rivals 🎩

**One human versus three GPT characters** (Ember, Sage and Onyx), in an original 40-square property-trading board game. It implements familiar mechanics without copying commercial art or trademarked property names.

## Play right now (this exact ChatGPT conversation)

1. Download `game.html` and **open it in any modern browser**. This is a self-contained HTML file; no build or server is needed.
2. Play your turns directly in the game interface.
3. When one of the GPT characters is active, click **Copy current GPT decision prompt**.
4. Paste the prompt into **the same ChatGPT conversation where you started the game**. ChatGPT will return a brief JSON move with `stateKey`, `choice`, and optional `banter`.
5. Paste its reply in the game and click **Apply ChatGPT's move**. Repeat at each GPT decision point, including any auctions.

This **chat relay mode genuinely uses your current ChatGPT conversation** to make strategic decisions for all three GPT seats. A browser page cannot independently read this chat or pull future ChatGPT replies, so copy/paste is required. The game itself never secretly substitutes scripted bots for the GPT opponents.

## Optional: automatic OpenAI model opponents

To avoid copying decisions, you can host the local server and connect a **separate API model session**. This uses OpenAI API credits (separately billed from ChatGPT subscriptions). It is still a GPT model, but it is *not the same live conversation* as your chat above.

```bash
# Node.js 20+ required; there are no third-party packages to install
cd block-rivals
# macOS/Linux:
OPENAI_API_KEY=your_key_here npm start
# Windows PowerShell (set this in the terminal, NOT a web form):
$env:OPENAI_API_KEY="your_key_here"
npm start
```

Then open `http://127.0.0.1:8787`. On a GPT turn, choose **Play GPT turns automatically**, or continue with chat relay mode. The server holds the API key; the frontend never needs it. By default, automatic mode uses `gpt-6.1-sol`; set `OPENAI_MODEL=gpt-6-astra` in your environment to select Astra (subject to account/model access). API errors stop the automatic mode instead of silently switching to a scripted opponent.

## Main rules

- Four seats: one human + three GPT characters. **$1,500** each to start; $200 on passing START.
- 40 squares, 22 color-group properties, 4 stations and 2 utilities.
- Buying is optional; **every declined unowned property starts an open ascending auction**. Any solvent player, including the decliner, may bid or pass.
- Own a complete color group to **double unimproved rent**. Buildings change the rent to the property's house/hotel level.
- **Even development:** every street in a group must be developed and sold back evenly. All of its streets must be owned and unmortgaged. There are **32 bank houses and 12 bank hotels**.
- Houses and hotels cost standard group-based amounts; buildings sell at half cost. Hotels require and exchange four houses when upgrading/downgrading.
- **Mortgage** any deed for half its purchase price if no buildings remain in its color set. Mortgaged deeds collect no rent. Redeem by paying 110% of mortgage *value* (55% of purchase price). Mortgaged deeds can be traded, with a mortgage-interest transfer fee.
- Stations have escalating rent based on stations owned. Utilities charge 4× or 10× dice totals.
- Income tax, luxury tax, card penalties and jail fines **feed the Vacation Fund**. Landing on **VACATION** pays you the entire pot, then resets it to $0.
- Jail, three doubles in a row, attempts to roll doubles out of jail, $50 bail, get-out-of-jail cards, Chance/Community-style cards, tradable deeds/cash, debt recovery and bankruptcy are implemented.
- Saved games persist automatically in browser local storage; **Export save** and **Import save** transfer games to another browser or device.

### Known differences from the commercial game

- Original locations/card text/art are used. The 16-card decks reproduce the *mechanic*, not copyrighted text; not every card is identical to another board game.
- If someone goes bankrupt owing the bank rather than a player, bank-owned properties return to the unowned pool instead of being automatically auctioned in a separate batch. Owing a player transfers deeds to that player.
- Trading is initiated in the human UI. GPT opponents can accept or decline an offer, but the first release does not generate unsolicited AI trade proposals.
- There is no multiplayer network, cheating prevention, or server-side persistent account. This is a one-human board game with AI decision seats.

## Development

The plain JavaScript engine is pure, deterministic and dependency-free: `newGame(seed)`, `legalActions(state)`, and `applyAction(state,action)`; calling `applyAction` produces an independently validated updated state without mutating the input. This also makes it safe for another coding agent to continue development in a branch.

```bash
npm test          # game rules + deterministic simulated games + mocked API integration
npm run build     # rebuild the single-file offline game.html from source
npm start         # local static host and optional AI API bridge
```

### Security

The optional API server binds only to `127.0.0.1`, blocks cross-origin requests, requires JSON, and never serves the API key. Do **not** put an API key inside `game.html` or commit credentials to GitHub. No external libraries or trackers are loaded by the game.
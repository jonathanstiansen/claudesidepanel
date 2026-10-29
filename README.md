# thread-refs

A side panel for Claude Code that shows what a session touched, on desktop and in the terminal.

## What it shows

- **Goal**: one line you type at the top; it saves as you type.
- **Pull requests**: every GitHub PR link in the session, with its state and CI result. Sort and filter it from the title row. Click a PR, or press its number, to open it.
- **Artifacts**: what the session published, newest version shown.
- **Sub-agents**: the agents the session started, with their status.
- **Tooling**: the skills and plugins the session used.

Each pill folds with ▾/▸. A twinkling starfield sits behind the pills.

## Install

Type this at the prompt of a terminal Claude Code session:

```
/plugin install thread-refs --marketplace jonathanstiansen/claudesidepanel
```

Answer `y` to add the marketplace, then pick a scope. Open the panel with `/thread-refs`, or paste a PR link.

## Needs

- The [GitHub CLI](https://cli.github.com), signed in (`gh auth login`). PR rows read their state and CI through it.

## Settings

| Setting | What it does |
|---|---|
| `linearWorkspace` | Your Linear workspace slug (the part after `linear.app/`). When set, a 🎫 beside a PR opens its Linear ticket, found as `[ABC-123]` in the title or `abc-123` in the branch. Empty: no ticket links. |

Change it in `/config`.

## Develop

```
claude plugin validate .
claude plugin test .
```

Run from a folder with `claude --plugin-dir <this folder>`.

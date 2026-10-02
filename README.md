# webai-hands

[中文](README.zh-CN.md)

> Give web AI a pair of hands: type in a chat page, your computer does the work.

## What is this?

Chat with a **free** web AI — like DeepSeek's free tier — and tell it what you want done on your computer. The AI writes a command, a small browser extension picks it up, and a tiny program on your computer runs it. The result comes back right into the chat box.

No copy-pasting. No switching windows to play "messenger". No paid API keys.

**In one line**: the web AI's brain + your computer's hands = a complete agent, for free.

## What can it do?

Anything you can do in a terminal, the AI can now do for you by chatting:

- Organize files, search your disk, batch-rename photos
- Git: status, pull, commit, push — without touching the command line
- **Drive Blender**: create objects, move things around, render — just describe it in words
  ([verified live](examples/blender/) with Blender 5.2.2 + the official Blender MCP add-on)
- ...anything else you can describe clearly

## Works with

| Website | Status |
|---|---|
| `chat.deepseek.com` | ✅ Verified (free tier works) |
| `muse.ai` | ✅ Verified |

More sites can be added with a small adapter — see `FOR-AI.md`.

## Install (about 5 minutes)

You need: Google Chrome (or any Chromium browser) and Python 3 on your computer.

**Step 1 — install the extension**

1. Open `chrome://extensions` in your browser
2. Turn on **Developer mode** (top right corner)
3. Click **Load unpacked** and select the `extension/` folder of this project

**Step 2 — install the local program**

- macOS: open Terminal and run `python3 native-host/install.py`
- Windows: double-click `native-host/install_windows.bat`

**Step 3 — check it works**

1. Click the extension icon in your toolbar → **Ping**
2. It shows "connected: \<your computer name\>" — you're good to go

Full walkthrough: [`docs/first-install.md`](docs/first-install.md).

## Try it

Open DeepSeek (or Muse) in your browser and paste [`AI-GUIDE.md`](AI-GUIDE.md) into the chat — it's a short manual that teaches any AI how to use webai-hands. Then just talk:

> "List the 10 biggest files in my Downloads folder."

The AI sends a command block, the extension runs it, and the answer appears in the chat.

## Send files to the AI

The AI can pull a file from your computer and attach it to the chat —
no manual uploading. Just ask:

> "Summarize this PDF for me: /Users/me/Documents/report.pdf"

The AI fetches the file through the bridge and attaches it as a real
chat attachment. Guardrails: sensitive paths (SSH keys, browser cookies,
`.env`, …) are refused, single files are capped at 25MB, and nothing
leaves your machine unless the AI asks for it in the chat.

## For developers

- `extension/` — Chrome MV3 extension: grabs command blocks, returns results
- `extension/adapters/` — one small file per website (~30–60 lines each)
- `native-host/` — Python program that runs the commands (no network ports; talks only to this extension)
- `examples/blender/` — drive Blender over its MCP socket; no MCP client app needed

Adding a new website = one adapter file + one line in `manifest.json`. See `FOR-AI.md`.

## Security

- The local program opens **no network ports**; it only talks to this extension (ID-checked)
- It never receives, stores, or types your passwords; anything needing admin rights pops a system dialog for **you** to approve
- The AI must show you a destructive command and get your OK before running it

## Donate

If webai-hands saves you time, consider buying me a coffee:

- [Ko-fi](https://ko-fi.com/achillesy)
- [PayPal](https://paypal.me/achillesnewman)

## License

Free for non-commercial use. Copyright © 2026 Achillesy. See [LICENSE](LICENSE).
Commercial use or resale is not allowed.

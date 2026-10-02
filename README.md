# webai-hands

[中文](README.zh-CN.md)

> Give web AI a pair of hands: type in a chat page, your computer does the work.

## What is this?

Open a **free** web AI (DeepSeek, Muse) and let this extension control
your computer.

The web AI is no longer just a chat box — you ask, it answers, and you do
the running around yourself. Now it has hands: tell it what to do, and it
does it for you.

Unlike AI companions you install on your machine, the web AI needs no API
key. You are not hiring an assistant — you are giving a free AI teacher a
pair of working hands.

**In one line**: web AI's brain + your computer's hands = a free agent.

## Quick start

**1. Get the project**

Clone it, or download the ZIP from GitHub:

    git clone https://github.com/Achillesy/Python-webai-hands.git

**2. Open a web AI**

Go to [chat.deepseek.com](https://chat.deepseek.com) or [muse.ai](https://muse.ai).
Both free tiers work.

**3. Hand it the install guide**

Upload **`AI-INSTALL.md`** into the chat (drag the file in, or paste its
content). The AI walks you through installing the extension and the local
helper, then verifies it works.

From now on, just talk:

> "List the 10 biggest files in my Downloads folder."

## Using it every day

The AI needs its manual in context. Which file depends on the site:

| Site | How to give the AI its manual |
|---|---|
| **DeepSeek** (no long-term memory) | New task → new chat → upload `AI-GUIDE.md`. Every fresh chat needs the file again. |
| **Muse** (long-term memory) | Upload `AI-GUIDE.md` once and it remembers — or paste the GitHub link and let it read the project itself. |

Which file to give the AI:

- First time / something's broken → `AI-INSTALL.md`
- Everyday use → `AI-GUIDE.md`
- Drive Blender → `AI-BLENDER.md`
- Modify the extension / add a new site → `AI-EVOLUTION.md`

## What can it do?

Anything you can do in a terminal:

- Organize files, search your disk, batch-rename photos
- Git: status, pull, commit, push — without the command line
- Drive Blender: create objects, move things, render
- Send files (PDFs, code, images) to the AI as real chat attachments

## For developers

Small project: a Chrome MV3 extension plus a Python host. Adding a new
website = one adapter file (~30–60 lines) + one line in `manifest.json`.
Point your favorite coding AI at the repo and let it read the code — the
adapter interface is documented in `AI-EVOLUTION.md`.

## Security

- The local program opens **no network ports**; it talks only to this extension (ID-checked)
- It never sees your passwords; anything needing admin rights pops a system dialog for **you** to approve
- The AI must show you a destructive command and get your OK first

## Support

webai-hands is free. If it saves you time, buy me a coffee:

- [Ko-fi](https://ko-fi.com/achillesy)
- [PayPal](https://paypal.me/achillesnewman)

China users can scan:

| WeChat | Alipay |
|---|---|
| ![](sponsor/wechat.jpg) | ![](sponsor/alipay.jpg) |

Support is voluntary and changes nothing about the software.

## License

Free for non-commercial use. Copyright © 2026 Achillesy. Commercial use
or resale is not allowed. See [LICENSE](LICENSE).

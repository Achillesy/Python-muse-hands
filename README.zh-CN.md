# webai-hands

[English](README.md)

> 给 Web AI 一双手：在聊天页面里说话，你的电脑动手干活。

## 这是什么

打开**免费**的网页 AI（比如 DeepSeek 免费版），用说话的方式告诉它你想让电脑做什么。AI 写一条命令，浏览器小扩展抓到它，电脑上的小程序执行它，结果直接回到聊天框里。

不用复制粘贴，不用来回切窗口当"传话筒"，不用买付费 API。

**一句话**：Web AI 的大脑 + 你的电脑的手 = 完整智能体，还免费。

## 能做什么

终端里能敲的命令，现在聊天就能让 AI 替你敲：

- 整理文件、搜磁盘、批量改照片名
- Git：status、pull、commit、push——不用碰命令行
- **操作 Blender**：建模、挪东西、渲染——用嘴说就行
  （[已实测](examples/blender/)：Blender 5.2.2 + 官方 Blender MCP 插件）
- ……其它你能说清楚的事都行

## 支持的 AI 站点

| 站点 | 状态 |
|---|---|
| `chat.deepseek.com` | ✅ 已验证（免费版可用） |
| `muse.ai` | ✅ 已验证 |

其它站点加个小适配器就行，见 `FOR-AI.md`。

## 安装（约 5 分钟）

需要：Chrome（或其它 Chromium 内核浏览器）+ 电脑上有 Python 3。

**第 1 步——装扩展**

1. 浏览器打开 `chrome://extensions`
2. 右上角打开**开发者模式**
3. 点**加载已解压的扩展程序**，选中本项目的 `extension/` 目录

**第 2 步——装本机小程序**

- macOS：打开终端，运行 `python3 native-host/install.py`
- Windows：双击 `native-host/install_windows.bat`

**第 3 步——验证**

1. 点工具栏里的扩展图标 → **测通桥**
2. 显示"已连接 \<你的机器名\>"——通了

详细图文步骤：[`docs/first-install.md`](docs/first-install.md)。

## 试一下

在浏览器里打开 DeepSeek（或 Muse），把 [`AI-GUIDE.md`](AI-GUIDE.md) 粘贴进对话——这是份简短手册，教会任何 AI 怎么用 webai-hands。然后直接说话：

> "把我 Downloads 里最大的 10 个文件列出来。"

AI 会发一条命令块，扩展执行它，答案回到聊天框里。

## 给开发者

- `extension/` — Chrome MV3 扩展：抓命令块、回填结果
- `extension/adapters/` — 每个站点一个小文件（约 30–60 行）
- `native-host/` — 执行命令的 Python 程序（不监听网络端口，只跟本扩展说话）
- `examples/blender/` — 直连 Blender 的 MCP socket，不需要 MCP 客户端

加一个新站点 = 写一个适配器文件 + 在 `manifest.json` 加一行。见 `FOR-AI.md`。

## 安全

- 本机程序**不监听任何网络端口**，只跟本扩展说话（校验扩展 ID）
- 不接收、不保存、不代输密码；需要管理员权限的操作会弹系统对话框，**由你亲手点**
- AI 跑破坏性命令前，必须先把命令给你看、等你同意

## 打赏

如果 webai-hands 帮你省了时间，欢迎请作者喝杯咖啡：

- [Ko-fi](https://ko-fi.com/achillesy)
- [PayPal](https://paypal.me/achillesnewman)

## 许可

免费使用（仅限非商业用途）。版权 © 2026 Achillesy，保留所有权利。见 [LICENSE](LICENSE)。
禁止商用、禁止转卖。

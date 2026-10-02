# webai-hands

> 给 Web AI 一双手：在聊天页面里下达命令，你的电脑执行。

## 这是什么

你在 DeepSeek / ChatGPT / Claude 等网页版聊天里说话，AI 输出一条约定格式的命令块，
浏览器扩展抓到它，通过 Chrome 官方的 Native Messaging 通道交给本机的 Python host 执行，
再把结果填回聊天框 —— 全程不需要你复制粘贴、不需要你切窗口当"传话筒"。

**一句话**：Web AI 的大脑 + 你的电脑的手 = 完整智能体。

## 支持的 Web AI

| 站点 | 状态 | 备注 |
|---|---|---|
| `chat.deepseek.com` | ✅ 已验证 | 自动发送已通 |
| `muse.ai` | ✅ 已验证 | |
| `chatgpt.com` | 🚧 待调试 | 欢迎贡献适配器 |
| 其它 | 🚧 欢迎提交 | 见 `FOR-AI.md` |

## 两条使用路径

### 路径 A：直接用（推荐给普通用户）

1. **装扩展**：`chrome://extensions` → 开开发者模式 → 加载已解压的 `extension/` 目录
2. **装 host**：
   - macOS：`python3 native-host/install.py`
   - Windows：双击 `native-host/install_windows.bat`
3. **验证**：点扩展图标 → 「测通桥」→ 显示"已连接 <机器名>"即通

详细步骤见 [`docs/install.md`](docs/install.md)。

### 路径 B：自己调试（推荐给开发者和其它 AI）

这个项目的设计哲学是**开放的、可扩展的**。你可以：

- 用你偏好的 AI 助手，让它读 [`FOR-AI.md`](FOR-AI.md)，帮你为自己的 WebAI 写适配器
- 参考 `extension/adapters/muse.js`（30 行）和 `extension/adapters/deepseek.js`（60 行）
- 加一个新站点 = 写一个适配器文件 + 在 `manifest.json` 注册，核心层零改动

详细的"给 AI 的调试指引"见 [`FOR-AI.md`](FOR-AI.md)。

## 架构
    网页 AI 对话  -->  Chrome 扩展  -->  Python host  -->  本机 shell
     你在这里说话      抓命令块          执行命令          真执行
                      填回结果          返回结果
                              ^
                     Native Messaging（本机 stdio，无网络端口）

三个核心组件：

- extension/ — Chrome MV3 扩展：内容脚本抓取 muse-exec 命令块，去重、心跳、结果填回、自动发送
- extension/adapters/ — 每站点一份 DOM 适配器（30-60 行），定义该站点里代码块、输入框、发送按钮的位置
- native-host/ — Python host（host 名 com.webai.hands）：执行 shell，返回 stdout/stderr/exit_code/耗时/hostname

## 安全边界

- host 不监听任何网络端口，只跟白名单里的扩展 ID 说话
- host 不接收、不保存、不代输密码；提权走系统弹窗（macOS osascript / Windows UAC），由人亲手确认
- 命令块里可以指定 host 字段做多机路由，不匹配的机器静默忽略（fail-closed）
- 已执行的 id 记在 host 侧 exec_history.json，页面刷新、扩展重装都不会重放历史命令

## 命令块格式

AI 在对话里输出一个代码块，语言标记为 muse-exec，块里是 JSON。
单行或两行都支持。

单行（JSON 里带 cmd 字段）：

    {"muse":"exec","id":"unique-id-001","cmd":"echo hello"}

两行（JSON 首行，命令正文从第二行起）：

    {"muse":"exec","id":"unique-id-002"}
    ls -la ~/Downloads

可选字段：

- host: "机器名" — 只让指定机器执行（省略 = 所有装了扩展的机器都执行）
- shell: "zsh" — 指定 shell（默认：mac 走 zsh，Windows 走 PowerShell）
- timeout: 60 — 秒数（默认 120）

## 自我诊断

如果你觉得"没反应"，让 AI 助手发一个诊断块：

    {"muse":"exec","id":"diag-001","cmd":"__diag__"}

host 会回报本机 hostname、pid、最近执行历史、日志尾巴。AI 据此判断断在哪一段。

## 文档

- FOR-AI.md — 给其它 AI 的调试指引（想让 AI 帮忙，从这里开始）
- DESIGN.md — 架构设计与技术决策
- docs/install.md — 面向普通用户的安装步骤

## 许可

MIT

## 贡献

欢迎为你的 WebAI 写适配器、提 PR、开 issue 报告哪个站点不通。
加新站点 = 一个 30 行的 extension/adapters/xxx.js。

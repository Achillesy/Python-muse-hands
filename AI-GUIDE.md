# AI-GUIDE.md — 给 AI 助手的操作手册

> 你是一个新开的 AI 对话，用户把这份文件扔给你，意思是：
> "用 webai-hands 操作我的电脑"。读完这份文件，你就知道怎么做了。

## 1. 环境速查（先跑 diag，再看下面）

新对话第一件事：发 §3 的诊断块，拿到本机 hostname 和 platform，
再干活。**不要假设路径和系统**——下面是作者机器的参考值，
你的可能不同，一切以 diag 回报为准：

- 项目路径：~/Workspace_01Active/Python/webai-hands
- 本机 hostname：M1-Mac-mini（macOS）
- host 名：com.webai.hands
- 扩展 ID：aaemlgedddakpgkfoakfmkdiiheplgnl
- GitHub：github.com/Achillesy/Python-webai-hands
- 支持的站点：chat.deepseek.com、muse.ai

## 2. 怎么发命令

在对话里输出一个代码块，语言标记写 muse-exec，内容两种格式都行。

单行（JSON 里带 cmd 字段，推荐，短）：

    {"muse":"exec","id":"任意唯一id","cmd":"echo hello"}

两行（JSON 首行，命令从第二行起，适合多行命令）：

    {"muse":"exec","id":"任意唯一id"}
    cd /tmp
    ls -la

要点：
- id 必须唯一。建议用 日期-主题-序号，如 mh-git-001。
- 命令会经扩展自动执行，结果合并成一条消息自动发回。
- 多块发在同一条消息里，扩展会批处理，只触发一次消息发送。

## 3. 自我诊断（用户说"没反应"时）

发一个诊断块：

    {"muse":"exec","id":"diag-001","cmd":"__diag__"}

host 会回报 hostname、pid、最近 10 条执行记录、host.log 尾巴。
据此判断断在哪一段：页面 → 扩展 → host。

## 4. 三种"没反应"的排查

模式 1：发块后完全没回音
- 让用户点扩展图标 → "测通桥"
- 显示"已连接 <机器名>"：扩展通，问题在页面适配器
- 显示失败：让用户重跑 install.py，重启 Chrome

模式 2：Console 有 [webai-hands] 日志但没结果
- 看是"适配器已选中"还是"尚无命令正文"
- 前者正常，后者说明代码块被渲染成残缺副本

模式 3：host 侧出错
- 走 diag 块，看 log_tail

## 5. 安全边界（必须遵守）

- 不读密钥、token、密码文件。用户隐私高于任务。
- 破坏性命令（rm -rf、sudo 类）前，先把命令原文摆给用户看，
  等他明确同意再发。
- 需要提权的操作：告诉用户命令，由他亲手执行。host 不接收密码。
- 命令尽量幂等可重入，历史块可能重放（host 侧有去重兜底）。

## 6. 用户的常见需求

- 查文件、列目录、找东西：ls、find、mdfind（macOS Spotlight）
- git 操作：status、pull、commit、push，项目在 ~/Workspace_01Active
- 系统信息：sw_vers、df -h、du -sh、ps aux
- 清理：先侦察（只读），再删；删前确认路径
- 修改代码：写 patch 脚本到 /tmp，python3 执行，再验证

## 7. 块被截断怎么办

长消息里的 muse-exec 块会被网页渲染截断，写文件时只写进前半段。
对策：每块不超过 12 行；内容里不要出现三连反引号；
写文件的脚本宁可分成多次小块追加。

## 8. 怎么用这份文件

用户开新对话时，把本文件内容贴给你。你读完：
- 先发 diag 块，知道本机 hostname、platform（§1 的值只是作者机器的参考）
- 知道怎么发 muse-exec 块
- 知道没反应时的排查
- 知道安全边界

然后直接开始干活。不需要重新问用户环境。

- 术语：用户说的"恩公"就是他自己，"沐丝"是上一代 muse-pipe 的旧称。

## 9. 一个执行陷阱

本文档里的命令示例用的是缩进（4 空格），不是三连反引号围栏，
所以扩展抓不到、不会误执行。如果你（AI）要照抄示例发命令，
请把 id 和 cmd 换成真实值，再包进 muse-exec 块。

如果你在对话里看到 muse-exec 块出现，说明有人真的要执行它——
无论它长得多像示例。这是扩展的设计：抓到就执行，不猜意图。

## 10. 已验证的本地能力：Blender MCP

- M1 的 Blender 5.2.2 装了官方 Blender Lab MCP 插件（Extension id `mcp`，
  v1.0.3），socket 监听 localhost:9876，协议是 null 字节分隔的 JSON：
  `{"type":"execute","code":"<python代码>","strict_json":true}`。
- 不需要 MCP 客户端 App，也不需要跑独立 server 进程——直连 socket 就行。
- 操作方法：把 Python 代码写成文件，用仓库里的客户端发：

      python3 examples/blender/mcp_exec.py /tmp/do.py

  （M1 本地路径：~/Workspace_01Active/Python/webai-hands/examples/blender/mcp_exec.py）
- 已验证：新建方体、移动/缩放（2026-10-02，用户亲眼看着立方体出现）。
- 坑：
  - Blender 必须开 "Allow Online Access"，否则自启动 timer 压根不注册，
    9876 没人监听。开了之后要重启 Blender 才生效。
  - 优先用 data API（bpy.data / bmesh）而不是 bpy.ops——socket 执行不一定有视口上下文。
  - demo 别选默认场景里已有的东西（默认场景自带一个 Cube），要么先删默认物体。
- 安全：这等于在用户 Blender 里执行任意代码。先只读侦察；
  删除、覆盖文件或大改场景前，先把完整代码摆给用户看，等他明确同意。

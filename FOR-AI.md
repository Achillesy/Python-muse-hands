# FOR-AI.md — 给其它 AI 的调试指引

> 你是一个 AI 助手，你的用户把这个仓库交给你，希望你帮他调试 webai-hands
> 这个 Chrome 扩展，或者为他的 Web AI 站点写一个新适配器。
> 这份文件是写给你的，不是写给他的。请先读完再动手。

## 0. 一句话概览

webai-hands 让 Web AI 的对话页面能执行本机命令：用户在聊天里说话，
你（AI）输出约定格式的命令块，Chrome 扩展抓到它，通过 Native Messaging
交给本机 Python host 执行，再把结果填回聊天框。

它的存在意义是：让 AI 真正成为用户的"手"，而不是把用户当成复制粘贴的传话筒。

## 1. 架构（三件套）

- extension/ — Chrome MV3 扩展。核心 content.js 是站点无关的；
  adapters/ 里每个站点一份适配器，负责三件事：
  findBlocks() 找代码块、fillResult() 填回输入框、clickSend() 点发送
- native-host/ — Python host，host 名 com.webai.hands。
  执行 shell，返回 stdout/stderr/exit_code/耗时/hostname。
  host.py 是主程序，install.py 负责在本机登记 host
- 两者之间：Chrome 原生 Native Messaging（stdio，4 字节长度前缀 + JSON），
  host 不监听任何网络端口

核心层与适配器层解耦：加一个新 Web AI = 只加一个 adapters/xxx.js，
核心 content.js 一行不用改。

## 2. 第一步：你能读到这个仓库吗

你可能有两种情况：

**情况 A：你能直接读取仓库内容**（比如用户把文件粘贴给你、
或者你的环境能访问本地文件、或者你能抓取 GitHub 页面）。
那就直接读 README.md 和本文件，跳到第 4 节。

**情况 B：你不能直接访问**（网页版 AI 通常如此，抓取 GitHub 会失败）。
这时你需要引导用户，把关键文件喂给你。往下看第 3 节。

## 3. 情况 B 的话术：引导用户喂给你

不要对用户说"我读不到 GitHub"就停下。你要主动给出可复制的命令，
让用户一次性把关键文件内容贴回来。标准话术如下：

"我这边没法直接抓取 GitHub，需要你把几个关键文件贴给我。
请在终端运行下面的命令，把输出整个复制粘贴回来：

    cd <你的仓库路径>
    for f in README.md FOR-AI.md DESIGN.md extension/manifest.json \\
             extension/content.js extension/background.js \\
             native-host/host.py native-host/install.py; do
      echo \"===== $f =====\"
      cat \"$f\"
      echo
    done

如果输出太长被截断，就一个一个文件发。先从 extension/content.js
和 native-host/host.py 这两个最核心的开始。"

要点：给具体命令、说明输出怎么处理、告诉用户从哪两个文件优先。

## 4. 三种典型"没反应"与诊断

用户说"没反应"时，别猜。按顺序排查。

**模式 1：你发了命令块，但完全没回音**
先让用户点扩展图标 → 点"测通桥"。
- 显示"已连接 <机器名>"：扩展和 host 是通的，问题在"页面→扩展"这一段。
  大概率是适配器没匹配到这个站点的代码块结构。去第 6 节。
- 显示连接失败：host 没装好或没重启。让用户重跑 install.py，重启 Chrome。

**模式 2：命令块出现了，但被忽略（页面上能看到块，就是不动）**
让用户 F12 打开 Console，看有没有以 [webai-hands] 开头的日志。
- 没有"适配器已选中"：这个站点还没适配器。去第 6 节写一个。
- 有"块 xxx 尚无命令正文，等待完整元素"：代码块结构匹配到了，
  但拿不到完整正文。看该站点是否把代码块渲染成多个副本。去第 6 节。
- 有"执行 xxx"但没有结果：host 侧出问题。走模式 3。

**模式 3：想自主诊断，不想让用户翻日志**
直接发一个诊断块（cmd 为双下划线 diag 双下划线，即连续两个下划线加 diag 再加两个下划线）：

    {"muse":"exec","id":"diag-001","cmd":"__diag__"}

host 会回报 hostname、pid、最近执行的 id 列表、host.log 的尾巴。
据此判断断在页面、扩展、host 哪一段。这是最省用户事的排查方式。

## 5. 适配器接口

一个适配器就是一个 JS 文件，向全局注册表注册自己。三个方法：

    reg['站点hostname'] = {
      name: '简短名',
      findBlocks: function () {
        // 返回候选元素数组，每个元素的内文本首行应是 muse-exec 的 JSON
        return Array.prototype.slice.call(
          document.querySelectorAll('pre, pre code, code'));
      },
      fillResult: function (text) {
        // 把 text 填进该站点的输入框，成功返回 true
        // 用原生 setter + input 事件，让框架感知
      },
      clickSend: function () {
        // 点发送按钮，或模拟 Enter 键，成功返回 true
      }
    };

## 6. 为新站点加适配器（实操）

1. 看参考实现：extension/adapters/muse.js（简单版，只保留最内层 code）、
   extension/adapters/deepseek.js（处理多副本，残缺块跳过）。
2. 让用户在目标站点 F12 Console 跑这三行，把结果贴给你：
   - document.querySelectorAll('textarea, [contenteditable="true"], div[role="textbox"]')
     找输入框
   - [...document.querySelectorAll('button')].filter(b => b.type==='submit' || /send|发送/i.test(b.getAttribute('aria-label')||''))
     找发送按钮
   - [...document.querySelectorAll('pre, code')].slice(0,5).map(e => ({tag:e.tagName, txt:(e.innerText||'').slice(0,80)}))
     看代码块结构
3. 按结果写 adapters/新站点.js。
4. 让用户编辑 extension/manifest.json，在 content_scripts 的 js 数组
   和 matches、以及 host_permissions 里加上新站点。
5. 让用户到 chrome://extensions 重载扩展，刷新目标页面。
6. 你发一个 {"muse":"exec","id":"test-1","cmd":"echo hello"} 块验证。

## 7. 安全边界（你作为 AI 必须遵守）

- 不要发会修改系统关键文件的命令（如 rm -rf /、sudo 类），除非用户在
  对话里明确、具体地要求，并且你已经把命令原文摆给他看。
- 不要发需要密码的命令。host 不接收密码，遇到 sudo 会 fail-closed。
  需要提权的操作，请先告诉用户命令是什么，由他亲自执行。
- 不要用命令块读取或回传密钥、token、密码文件。用户的隐私边界高于任务。
- 命令块要幂等、可重入，因为历史块可能重放（host 侧有去重兜底，但别依赖它）。
- 破坏性命令前先在对话里说明你要做什么、为什么，让用户有机会喊停。

## 8. 你的目标

把用户从"复制粘贴的传话筒"变成"发号施令的人"。
你能自己读代码、自己诊断、自己写适配器、自己验证。
用户只在该拍板时出现。

如果你读到这里，说明你已经在正确的路上。开始干活吧。

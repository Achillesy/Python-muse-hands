# AI-EVOLUTION.md — 改造 webai-hands（给 AI 助手）

> 读者：能读到仓库代码、要调试本扩展或写新站点适配器的 AI。
> 只是日常操作用户电脑，看 AI-GUIDE.md；装不上/排错，看 AI-INSTALL.md。

## 0. 这是什么

webai-hands 让 Web AI 的对话页执行本机命令。用户说话，AI 输出命令块，
Chrome 扩展抓到它，经 Native Messaging 交给本机 Python host 执行，
结果回填聊天框。

## 1. 架构（三件套）

- extension/ — Chrome MV3 扩展。核心 content.js 站点无关；
  adapters/ 每站点一份，负责三件事：findBlocks 找块、fillResult 回填、clickSend 发送。
- native-host/ — Python host，host 名 com.webai.hands。执行 shell，
  返回 stdout/stderr/exit_code/耗时/hostname。host.py 主程序，install.py 登记。
- 两者之间：Chrome 原生 Native Messaging（stdio，4 字节长度前缀 + JSON）。
  host 不监听任何网络端口。

核心层与适配器层解耦：加新站点 = 只加一个 adapters/xxx.js，核心 content.js 不动。

## 2. 你能读到仓库吗

情况 A：能直接读（用户粘了文件、或你能访问本地/GitHub）。直接读代码，跳到 §4。

情况 B：不能直接读（网页版 AI 常如此）。让用户跑一条命令，把关键文件喂给你：

    cd <仓库路径>
    for f in README.md AI-EVOLUTION.md extension/manifest.json \\
             extension/content.js extension/background.js \\
             native-host/host.py native-host/install.py; do
      echo "===== $f ====="; cat "$f"; echo; done

太长就一个一个发。优先 content.js 和 host.py。

## 3. 适配器接口

一个适配器 = 一个 JS 文件，向全局注册表注册自己。三个方法：

    reg["站点hostname"] = {
      name: "简短名",
      findBlocks: function () { /* 返回候选元素数组 */ },
      fillResult: function (text) { /* 填进输入框，成功返回 true */ },
      clickSend:  function () { /* 点发送，成功返回 true */ }
    };

fillResult 用原生 setter + input 事件，让框架感知。

## 4. 为新站点加适配器

1. 看参考：extension/adapters/muse.js（简单）、deepseek.js（多副本）。
2. 让用户在目标站点 F12 Console 跑这几行，结果贴回来：
   - 找输入框：document.querySelectorAll("textarea, [contenteditable=true], div[role=textbox]")
   - 找发送按钮：[...document.querySelectorAll("button")].filter(b => /send|发送/i.test(b.getAttribute("aria-label")||""))
   - 看块结构：[...document.querySelectorAll("pre, code")].slice(0,5).map(e => e.innerText.slice(0,80))
3. 按结果写 adapters/新站点.js。
4. 编辑 extension/manifest.json，在 content_scripts.js、matches、host_permissions 加新站点。
5. chrome://extensions 重载扩展，刷新目标页面。
6. 发一个 echo hello 块验证。

## 5. v2 门禁与版本号（改扩展必读）

### 5.1 v2 门禁

content.js 的 parseBlock 要求命令块 JSON 首行带 "v":2，否则忽略。原因：
文档里的示例和真命令形式相同，黑名单堵不完（<唯一id> 这类变体总会漏）。
门禁一劳永逸：示例故意不带 v → 永不执行；旧会话残留块不带 v → 不重演。

### 5.2 版本号规矩

改任何扩展文件后，必须 bump extension/manifest.json 的 version，
再重载扩展。卡片上的版本号是"生效没"的唯一可靠信号。
content.js 启动日志会打印版本（VERSION 取自 manifest，不用两处维护）。

## 6. 相关文档

- 日常交互、安全边界 → AI-GUIDE.md
- 安装、测通桥、排错 → AI-INSTALL.md
- 操作 Blender → AI-BLENDER.md

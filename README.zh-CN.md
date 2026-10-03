# webai-hands

[English](README.md)

> 给 Web AI 一双手：在聊天页面里说话，你的电脑动手干活。

## 这是什么

打开**免费的**网页 AI（DeepSeek、Muse），用这个扩展让它操作你的电脑。

网页 AI 不再只是一个对话框——你提问、它回答，然后你自己动手搬运。
现在它有了双手：你说要做什么，它替你做完。

和别的需要装到电脑上的 AI 伙伴不同，网页 AI 不需要买 API。
你不是雇了个帮手，你是给免费的 AI 老师安上了一双干活的手。

**一句话**：Web AI 的大脑 + 你电脑的双手 = 免费智能体。

## 快速开始

**第 1 步——拿到项目**

克隆，或从 GitHub 下载 ZIP：

    git clone https://github.com/Achillesy/Python-webai-hands.git

**第 2 步——打开网页 AI**

去 [chat.deepseek.com](https://chat.deepseek.com) 或 [muse.ai](https://muse.ai)，免费版都能用。

**第 3 步——把安装手册交给它**

把 **`AI-INSTALL.md`** 上传进对话（拖文件进去，或直接粘内容）。
AI 会带你装好扩展和本机小程序，再验证能不能用。

之后直接说话就行：

> "把我 Downloads 里最大的 10 个文件列出来。"

## 日常使用

AI 需要把手册放在上下文里。给哪一份，看站点：

| 站点 | 怎么把手册交给 AI |
|---|---|
| **DeepSeek**（没有长期记忆） | 每做一件新事 → 新开对话 → 上传 `AI-GUIDE.md`。每个新对话都要再传一次。 |
| **Muse**（有长期记忆） | 上传一次 `AI-GUIDE.md` 就记住了——或者贴 GitHub 链接，让它自己读项目。 |

给 AI 哪一份：

- 第一次 / 出问题 → `AI-INSTALL.md`
- 日常操作 → `AI-GUIDE.md`
- 操作 Blender → `AI-BLENDER.md`
- 改扩展 / 加新站点 → `AI-EVOLUTION.md`

## 能做什么

终端里能敲的命令，现在聊天就能让 AI 替你敲：

- 整理文件、搜磁盘、批量改照片名
- Git：status、pull、commit、push——不用碰命令行
- 操作 Blender：建模、挪东西、渲染
- 把文件（PDF、代码、图片）作为真正的聊天附件发给 AI

## 给开发者

项目很小：一个 Chrome MV3 扩展 + 一个 Python host。加一个新站点
= 一个适配器文件（约 30–60 行）+ `manifest.json` 一行。把你的
编程 AI 指向这个仓库，让它读代码——适配器接口在 `AI-EVOLUTION.md` 里。

## 安全

- 本机程序**不监听任何网络端口**，只跟本扩展说话（校验扩展 ID）
- 不接收、不保存、不代输密码；需要管理员权限的操作会弹系统对话框，**由你亲手点**
- AI 跑破坏性命令前，必须先把命令给你看、等你同意

## 赞助

webai-hands 完全免费。如果它帮你省了时间，欢迎请作者喝杯咖啡：

- [Ko-fi](https://ko-fi.com/achillesy)
- [PayPal](https://paypal.me/achillesnewman)

国内用户也可扫码赞助：

| 微信 | 支付宝 |
|---|---|
| ![](sponsor/wechat.jpg) | ![](sponsor/alipay.jpg) |

赞助完全自愿，不影响任何功能。

## 许可

免费使用（仅限非商业用途）。版权 © 2026 Achillesy。禁止商用、
禁止转卖。见 [LICENSE](LICENSE)。

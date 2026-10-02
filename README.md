# muse-hands

云端 AI 的双手：Chrome 扩展在聊天页面里抓取命令块，经 Native Messaging
交给本机 Python host 执行，结果填回页面。用户只在聊天里说话，不再当传话筒。

## 架构（三件套）

- `extension/` — Chrome MV3 扩展：内容脚本抓取 `{"muse":"exec",…}` 命令块，
  去重、心跳，结果填回输入框（默认只填不发）
- `native-host/` — Python host（`com.muse.hands`）：执行 shell 命令，
  返回结果头 / cmd / stdout / stderr / exit code / 耗时 / hostname；
  `install.py` 一键登记 host
- `probe/` — 油猴探针（早期验证工具，阶段已收尾）

## 仓库结构

```
README.md               本文件
DESIGN.md               设计文档：§6 为 2026-10-01 拍板的正式版定稿（当前实现依据）；
                        §1–§5 为讨论阶段存档，只看§6 也能了解全貌
docs/first-install.md   首次安装与验收（Windows/Mac）
docs/discussion-log.md  逐日讨论纪要
protocol/task-queue.md  旧网关任务队列协议（muse-pipe 时代遗留，仅参考）
client/                 旧长轮询客户端（muse-pipe 时代遗留，仅参考）
```

## 当前进展（2026-10-02）

- M0 设计定稿、M1 host 打通、M2 端到端、M3 结果格式：已实现
- M4 安全加固（hostname 路由、扩展 ID 白名单、急停、diag 自检等）：设计中
- M5 真机验收（测试案例 001）：待排期
- 分期细节见 `DESIGN.md` §6.4

## 与 muse-pipe 的关系

muse-pipe（VPS 网关 + 长轮询）已于 2026-10-01 按当前状态结案退役；
muse-hands 是它的继任者，走浏览器传输路线，不依赖网关。

## 安全说明

- host 不监听任何网络端口，只跟扩展 ID 白名单里的扩展说话
- host 不接收、不保存、不代输密码；提权走系统管理员弹窗，由人亲手确认

# muse-python 设计方案

> 读者是未来的我（云端沐丝），不是恩公。写给自己看：下次恩公提起这个项目，
> 直接照此文档开干，不用他再提醒。初版 2026-09-30（时名 muse-hands）；
> 2026-10-01 经本地控制台试验后全面修订，项目改称 muse-python。

## 0. 一句话

`muse-python` 是恩公本地机器上的纯 Python 客户端：接收我（云端沐丝）经
muse-pipe 网关下发的命令，执行后回传结果，并把全过程记入本地审计日志。
需要 sudo 等权限的命令不自动执行，进人工待办槽等恩公亲手跑完再回填。
恩公只在聊天里下命令，不当传话筒；聊天本身不在这个项目里。

## 1. 硬约束（这些决定了架构，不要违背）

- 云端 VM：**无公网入站**；出站经拦截代理，**空闲超过 ~20 秒的响应隧道
  会被掐**（2026-09-30 实测）；原生 TCP 被沙箱 deny，只有 HTTPS 出站可靠。
- 用户机器全在 NAT 后，无公网入站。M1（Mac mini，192.168.31.20）是主力；
  PC（Codex-Win11，192.168.31.10）平时不开机（噪音大），支持 Wake-on-LAN。
- Cloudflare：经 CF 的 POST 等回包超过约 100 秒必被掐（2026-09-30 实测
  出 504）。所以一切等待都走"先收下、再轮询"，不长挂请求。
- VPS（reinhand.com）是双方唯一都能主动连出的交汇点。网关代码在
  FastAPI-muse-pipe 仓库的 `muse_server.py`，systemd `muse-pipe.service`，
  监听 127.0.0.1:8902，公网入口 `https://www.reinhand.com/muse-pipe`。
- 认证只有一套：`MP_TOKEN`，Bearer。网关 `.env` 常量，**永不进 git、
  永不进 Actions 日志、不在聊天正文出现**。我这边 VM 用
  `~/workspace/muse-pipe/.mp_token`（0600）。客户端侧 token 来源见 §4。
- **sudo 密码边界**：客户端永不接收、存储、传输恩公的 sudo 密码，也永不
  自己跑 sudo。需权限的命令只能由恩公本人在他的终端里执行（见 §6）。
- 流程纪律（恩公 2026-09-30 亲口定的）：**先谈设计再开发**，方案定稿前
  不写一行代码；他喊"不着急/等商量好"时立即停手。本次修订即按此纪律：
  先改文档，开工等他发话。

## 2. 技术栈定案（2026-10-01 修订）

- **客户端 = 纯标准库 Python 3.8+，零依赖**：一份代码在 macOS / Windows /
  WSL / Linux 上拷过去就能跑（HTTP 用 urllib，执行用 subprocess）。
  这是"完全的 Python 项目"的含义：不要网页前端，不要 FastAPI，不要 npm。
- **网关 = FastAPI，只在 VPS 上**（FastAPI-muse-pipe 仓库），任务队列
  `/tasks/*` 住在那儿，本项目只用不改。网关部署走既有 push-to-deploy，
  只认 `muse_server.py` 变更。
- **执行器 = shell 直执**（v1 唯一实现）。2026-09-30 初版设计是"客户端
  转交本地 Hermes agent 执行"，2026-10-01 修订降为预留：控制台试验已经
  实证，我把活拆成 shell 命令直执即可闭环，中间再塞一层本地 agent 只是
  多一层不确定性。`kind=hermes`、`kind=pipeline` 作为协议预留，以后真
  需要本地 agent / GPU 流水线时再实现。
- **聊天不在本项目**：恩公在 Muse app 或浏览器里和我对话（全系统通用）。
  muse-pipe 本地控制台网页（左聊右看）经试验定性为备选入口，保留在
  FastAPI-muse-pipe 仓库，不迁入本项目。
- **记录 = 本地 JSONL 审计日志**（`~/.muse-python/audit.jsonl`），纯文本
  一行一条，可查可删。不用数据库——试验结论是"看得见、留得住"就够了，
  JSONL 比 SQLite 更易直接翻、直接 grep。

## 3. 架构与职责

```
恩公（Muse app / 浏览器聊天，下达命令，只下一次）
  │
  ▼
我（大脑）：理解命令 → 判断是否需要本地执行 → 拆成 shell 子任务
  │  POST /tasks/submit {target, kind:"shell", task, needs_root}
  ▼
VPS 网关任务队列（muse-pipe 的一部分，见 §8；哑队列，只存取）
  │  GET /tasks/poll?target=<本机名>&timeout=50（客户端长轮询）
  ▼
muse-python 客户端（恩公机器常驻，纯标准库）
  ├─ needs_root=false → 登录 shell 直执 → POST /tasks/result
  └─ needs_root=true  → 进人工待办槽，终端醒目提示，等恩公执行后
                        粘回输出 → POST /tasks/result（同一 task_id）
  │  每一步都先写审计日志再动作
  ▼
我：轮询 GET /tasks/result/<id> → 验证输出 → 在聊天里回复恩公
```

各组件职责：

- **大脑（我）**：唯一的任务发起方和结果验证方。拆解、排序、核对都在我这。
  需权限的命令除了下发任务，还要在聊天里同步喊恩公一声（双保险，见 §6）。
- **VPS 网关**：哑队列。存任务、存结果、15 分钟无结果重投、2 小时遗忘，
  不理解任务内容。**本项目零改动网关**。
- **客户端**：哑执行器 + 记录员。普通命令拿到就跑，跑完交回，不做判断；
  权限命令只登记、只提示、只收回填，绝不代跑。崩了/断网了，任务会被
  网关重投（at-least-once），客户端按 task_id 去重（见 §5）。
- **恩公**：只剩两个动作——在聊天里下命令；在人工待办槽出现时，亲手在
  自己的终端跑那条权限命令并把输出粘回客户端。

## 4. 客户端运行方式

- 入口：`client/muse_python.py`（开工后新建，替换现有 Hermes 草稿
  `client/local_client.py`；草稿去留见 §9）。
- 启动：`python3 muse_python.py --target m1`（PC 上 `--target pc`）。
  常驻方式 v1 就是手动跑在终端里——人工待办槽本来就需要一个看得见的
  终端，先不搞服务化/自启。
- 配置优先级：CLI 参数 > 环境变量 > 状态目录文件。
  - `MP_TOKEN` / `--token` / `~/.muse-pipe-token`（0600）：网关凭证。
    沿用 muse-pipe 的 token 文件名，它本来就是同一套凭证；绝不打印。
  - `MP_BASE` / `--base`：默认 `https://www.reinhand.com/muse-pipe`。
  - `MP_TARGET` / `--target`：本机名，`m1` / `pc` / …。
- 状态目录 `~/.muse-python/`：`audit.jsonl`（审计日志）、
  `pending.json`（未完成的人工待办，重启后恢复提示）。整目录可删，
  删了等于清空记录、从零开始。
- 退出与急停：Ctrl-C 即停。停了就收不到命令——这就是急停，不需要
  额外开关（控制台试验的既有结论）。

## 5. shell 直执的执行规约（全部来自 2026-10-01 控制台实证）

- 只执行 `kind == "shell"`；其他 kind 回 `ok=false` 并说明"本客户端
  不支持"，把任务标 done，避免在网关队列里被反复重投。
- 以**登录 shell** 执行：`/bin/zsh -lc`，缺失时依次退 `/bin/bash -lc`、
  `/bin/sh -c`（Windows 上 v1 先只支持 WSL/macOS/Linux，见 §10）。
- cwd = 用户主目录；`stdin` 接 DEVNULL（非交互：等输入的命令读到 EOF
  即结束，不会挂住客户端）。
- **单条超时 300 秒**强杀进程，超时/异常的退出码记 -1。
- stdout+stderr 合并回传，stderr 的行前加 `[stderr]` 标注；输出客户端侧
  截断 10 万字符（网关上限 20 万）。退出码非 0 → `ok=false`。
- **同 task_id 本进程内只执行一次**：结果暂存在内存字典，网关重投时
  只重传旧结果、不重复执行（防 at-least-once 造成重复副作用）。
  已知限制：进程重启后去重失效——所以命令本身尽量写成可重入的。
- 每条命令执行前先落审计日志（command 行），执行后再落一条（result 行），
  崩溃了也能从日志看出死在哪一步。

## 6. 人工待办槽（sudo 等权限命令的唯一通道）

触发：任务带 `"needs_root": true`（由我在下发时判断标注），或命令本身
明显需要权限时我直接标。注意我还有一个平行义务：**在聊天里同步告诉
恩公有权限命令在等他**——客户端提示是记录完整性的保证，聊天喊话是
不让他等的保证，两条都要有（恩公 2026-10-01 原话：真正需要 sudo 的
时候必须在对话中告诉他，他执行后给结果）。

客户端行为：

1. 收到 needs_root 任务 → 不执行。写入 `pending.json`，审计记一条
   `manual_pending`，终端醒目打印：task_id、完整命令、"请在任意终端
   执行，把完整输出粘贴到下方，单独一行 `.` 结束；输入 `skip` 放弃"。
2. 恩公在**他自己的终端**里执行（sudo 密码输在那里，与客户端无关），
   把输出粘回客户端提示符。粘回内容即结果：客户端审计记
   `manual_result`，POST `/tasks/result`（同一 task_id），output 首行
   加 `[manual]` 标注来源；`ok` 由恩公粘回时可附带说明，缺省按他
   粘贴时客户端询问的一次确认（成功回车 / 失败输 `fail`）。
3. `skip` → 回传 `ok=false`、output 注明"恩公跳过，未执行"，任务闭环，
   我在聊天里据此改道。
4. 长时间没人理：任务受网关 2 小时 TTL 约束，过期即作废，我若仍需要
   会重新下发；`pending.json` 里的陈旧项在下次启动时提示清理。
   不回"中间状态"给网关（网关没有这个状态，硬塞假结果会把任务标死）；
   我轮询看到任务久处 in_flight，就知道是恩公还没动手，在聊天里跟进。

安全 invariants（写实现时逐条守）：

- 客户端永不拼接、永不执行 needs_root 命令，连"试运行"都不行。
- 客户端永不读取/保存 sudo 密码；审计日志里若恩公粘回的输出含敏感
  内容，那是他的输出，由他自己把握（日志在本地、可删）。
- 人工通道不改变审计要求：命令、回填输出、结果与自动任务同格式入账。

## 7. 审计日志（记录过程——本项目的脊梁）

`~/.muse-python/audit.jsonl`，一行一个 JSON 对象，append-only。
字段：

| 字段 | 说明 |
|---|---|
| `ts` | ISO 时间（本地时区） |
| `event` | `command` / `result` / `manual_pending` / `manual_result` / `client_start` / `client_stop` / `error` |
| `task_id` | 网关任务号（客户端自身事件可空） |
| `target` | 本机名 |
| `kind` | `shell`（预留 hermes/pipeline） |
| `needs_root` | true/false |
| `source` | `auto` / `manual` |
| `command` | 命令全文（command/manual_pending 时） |
| `ok` / `exit_code` | 结果（result/manual_result 时；exit_code 可空、超时 -1） |
| `output` | 输出全文（已按 §5 截断；manual 时为回填内容） |
| `note` | 备注（跳过原因、错误说明等，可空） |

同时终端打印人类可读的一行摘要（时间、task_id 短号、命令首行、结果），
让恩公坐在机器前就能看见手在干什么——这正是控制台右栏的价值，搬进
终端即可，不需要网页。

## 8. 协议（网关 /tasks/*，本项目不改动网关）

完整协议见 `protocol/task-queue.md`。要点与常量（网关 `muse_server.py`
现行值，2026-10-01 已在生产环境全链路实证）：

- `POST /tasks/submit`：body `{target, kind, task, needs_root?}` →
  `{"task_id": "task-<12位hex>", "status": "queued"}`。
- `GET /tasks/poll?target=<name>&timeout=50`：返回即标 in_flight；
  空等上限 50 秒（卡在 nginx/CF 上限之下）。
- `POST /tasks/result`：`{task_id, ok, output}`；网关截断 200KB。
- `GET /tasks/result/<task_id>`：`{"status": queued|in_flight|done, "result": {...}|null}`。
- `TASK_TTL=7200`（2 小时遗忘）、`TASK_REDELIVER=900`（15 分钟无结果
  重投）、at-least-once 语义——客户端去重因此是必须的（§5）。

## 9. 与 muse-pipe 的关系

- `FastAPI-muse-pipe` 是**可部署的网关 + 备选聊天入口**：`/tasks/*`
  永远留在那个仓库，本项目只引用、不复制网关代码。
- 本仓库（muse-python，GitHub 暂名 Python-muse-hands）是**项目主页**：
  设计、协议、客户端、纪要都在这儿。
- muse-pipe 本地控制台（`local_client.py` + `index.html`）是本项目的
  **试验田与参考实现**：§5 的执行规约就是从它已跑通的代码里提炼的，
  开工时照着移植成本地纯标准库版即可。控制台本体保留在那边当备选
  聊天入口，不迁入本项目。
- 本仓库现有 `client/local_client.py` 是 2026-09-30 的 Hermes 转交
  草稿，从未运行；开工写 `muse_python.py` 时它即删除（内容留在
  git 历史）。网关侧从未有过这个文件，无双份漂移问题。

## 10. 已定与待定

已定（2026-10-01 恩公裁决 + 试验结论，不再议）：

- [x] 聊天归 Muse app / 浏览器，本项目不做聊天界面（左栏多余）。
- [x] 客户端纯 Python（标准库零依赖），不做网页前端。
- [x] v1 执行器 = shell 直执；Hermes/DSH 转交降为协议预留。
- [x] 记录 = 本地 JSONL 审计日志 + 终端摘要，过程全留痕。
- [x] sudo 等权限命令走人工待办槽 + 聊天同步喊话，客户端永不代跑、
      永不接触密码。
- [x] 网关零改动，协议沿用已实证的 /tasks/*。

待定（开工前或开工时找恩公拍）：

1. GitHub 仓库 `Python-muse-hands` 是否改名为 muse-python 系名字。
2. 客户端常驻方式的后续：v1 手动终端跑；以后要不要开机自启
   （launchd/systemd/任务计划）——M1 与 PC 分别定。
3. Windows 原生（非 WSL）的 shell 执行形态（powershell？）：
   PC 的活先走 WSL，原生支持等真有需求再加。
4. 审计日志轮转/保留期：v1 不轮转（纯文本、量小）；长了恩公手动删
   或以后加按月切分。
5. 文件回传（本地生成图片/模型给我看）：v1 不做，以后按 roadmap 加。

## 11. 开工 checklist（恩公说"开始"之后按此执行）

1. [ ] 写 `client/muse_python.py`：长轮询 + shell 直执（§5）+
       人工待办槽（§6）+ 审计日志（§7），纯标准库。
2. [ ] 本地自测：VM 内起网关副本 + 客户端，跑通自动任务、权限任务
       （人工回填）、非 shell 回绝、错 token 401 四条路径。
3. [ ] M1 试验：恩公终端跑客户端，我从聊天里下发真实命令（先只读
       类），验证回传与审计日志，他验收。
4. [ ] 删除 `client/local_client.py` 旧草稿（git 历史留痕）。
5. [ ] 更新本文件 §10/§11 与纪要，push。
6. [ ] M1 跑顺后，再议 PC（target=pc）接入与常驻方式。

## 12. 纪要指针

历次讨论与裁决的全文在 `docs/discussion-log.md`（倒序）。本设计的所有
"已定"都能在那里找到出处；与纪要冲突时以纪要里恩公的最新原话为准，
并回头修订本文件。

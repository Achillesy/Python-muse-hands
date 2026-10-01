# muse-python

沐丝的手。云端大脑（Muse）在聊天里下达命令，经 muse-pipe VPS 网关派给
用户本地机器上的纯 Python 客户端执行，结果回传、过程全记录——恩公只在
聊天里说话，不再当传话筒。

> 本仓库暂沿用 `Python-muse-hands` 这个名字。项目本体自 2026-10-01 起
> 改称 **muse-python**；仓库是否跟着改名，由恩公定。

## 它做什么

- **接收命令**：客户端长轮询网关任务队列，取云端下发的 shell 命令。
- **执行并回传**：在本机以登录 shell 直接执行，输出与退出状态回传网关，
  云端验证后向恩公汇报。
- **记录过程**：每条命令、每次执行、每份输出都落本地审计日志，随时可查——
  这是本地控制台试验留下的核心结论：记录才是价值所在。
- **人工接力**：需要 sudo 等权限的命令不自动执行，进客户端的人工待办槽。
  恩公自己在终端里跑（密码只出现在他的终端里，客户端永不接触），把输出
  粘回客户端，结果沿同一通道回传，记录不缺页。

聊天不在这个项目里：恩公在 Muse app 或浏览器里和云端对话即可（全系统
通用）。本地控制台网页只留作备选入口，住在 FastAPI-muse-pipe 仓库。

## 架构

```
恩公（Muse app / 浏览器聊天，下达命令）
  → 云端沐丝：判断、拆解，下发 shell 任务
  → VPS 网关 /tasks/*（FastAPI-muse-pipe，Bearer MP_TOKEN，本项目不改它）
  → 本地客户端（纯标准库 Python，常驻长轮询）
      ├─ 普通命令：登录 shell 直接执行 → 回传结果
      └─ 需权限命令：进人工待办槽 → 恩公手动执行 → 粘回输出 → 回传结果
  → 云端沐丝：取结果、验证、汇报
```

## 技术栈

- 客户端：**纯标准库 Python 3.8+，零依赖**。拷到 macOS / Windows /
  WSL / Linux 就能跑，不装任何包。
- 网关：FastAPI，只在 VPS 上（FastAPI-muse-pipe 仓库）；任务队列住在
  那儿，本项目只用它，不复制网关代码。
- 记录：本地 JSONL 审计日志（`~/.muse-python/audit.jsonl`），
  纯文本，可查可删。

## 仓库结构

```
README.md               本文件：项目主页
DESIGN.md               设计方案（写给云端沐丝自己看的，开干时照此执行）
docs/discussion-log.md  讨论纪要
protocol/task-queue.md  网关任务队列协议（给实现者看的）
client/                 客户端代码（现有 local_client.py 是旧 Hermes 草稿，
                        muse-python 客户端开工后在此替换）
```

## 相关项目

- [FastAPI-muse-pipe](https://github.com/Achillesy/FastAPI-muse-pipe) ——
  VPS 网关与本地控制台都在那儿；`/tasks/*` 队列随网关部署，本项目只是用它。
- 本地控制台（该仓库的 `index.html` + `local_client.py`）是 2026-10-01
  的试验田：它试出了"云端下令、本地执行、结果回传"这条链路，也试出
  左栏聊天多余、右栏记录才是要留下的东西。muse-python 即由此收敛而来；
  控制台本体保留，作为备选聊天入口。

## Roadmap

1. 按 DESIGN.md 写 muse-python 客户端（shell 直执 + 审计日志 + 人工待办槽）。
2. M1 先行（target=m1），再扩到 PC（target=pc）。
3. 预留任务类型以后再加：hermes（本地 agent 任务）、pipeline
   （数字人视频处理，派给有 GPU 的机器）。

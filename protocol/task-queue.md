# 任务队列协议（网关 /tasks/*）

实现位置：`FastAPI-muse-pipe` 仓库的 `muse_server.py`（随网关 push-to-deploy
上线）。muse-python 只是这套协议的使用方，不实现网关、不修改网关。
本文件给实现者（云端沐丝、muse-python 客户端、排障时的人）看。

2026-10-01 修订：`kind=shell` 直执成为主要用法（已在生产环境全链路实证）；
新增 `needs_root` 字段与人工执行约定；Hermes 转交降为预留。

## 角色

- **提交方**：云端沐丝（大脑）。唯一的任务发起方和结果验证方。
- **网关**：哑队列，只存取，不理解任务内容。
- **执行方**：muse-python 客户端（`client/muse_python.py`）。普通命令
  拿到就跑、跑完交回；`needs_root` 命令不执行，进人工待办槽等恩公
  亲手跑完回填（见"人工执行约定"）。

## 认证

全程 `Authorization: Bearer <MP_TOKEN>`，和网关现有接口同一套密钥。
MP_TOKEN 永不进 git、进 Actions 日志、进聊天正文。

## 端点

### POST /tasks/submit —— 提交任务

Request body：

```json
{
  "target": "m1",
  "kind": "shell",
  "task": "cd /Users/achilles/Workspace_01Active/FastAPI/muse-pipe && git pull",
  "needs_root": false
}
```

- `target` 必填：`m1` / `pc` / …，客户端启动时用 `--target` 认领。
- `task` 必填：任务正文。`kind=shell` 时即为要执行的 shell 命令；
  空则 400。
- `kind` 取值：
  - `shell`：客户端以登录 shell 直接执行（v1 唯一实现）。
  - `hermes`：预留（转交本地 agent），v1 客户端收到会回绝并标 done。
  - 其他值同样回绝，避免在队列里反复重投。
  - 注意：网关对省略的 `kind` 按 `hermes` 处理，**提交方必须显式
    写 `"kind": "shell"`**，不要依赖默认值。
- `needs_root` 可选，默认 false。true 表示需要 sudo 等权限：客户端
  **不执行**，走人工待办槽（见下）。此字段由提交方与客户端约定，
  网关只负责随任务记录透传（开工时对 `muse_server.py` 源码核一遍）。

Response：`{"task_id": "task-<12位hex>", "status": "queued"}`。
提交即唤醒正在长轮询的客户端。

### GET /tasks/poll?target=m1&timeout=50 —— 客户端长轮询拿任务

- 返回该 target 的待办任务：`status=queued` 的，以及 `in_flight` 超过
  15 分钟没结果的（视为执行方已死，重投）。
- 返回的任务即被标记 `in_flight`（`delivered_at=now`）。
- 任务单项格式：`{"task_id","kind","task","needs_root", ...}`。
- 空等最多 50 秒（必须卡在 nginx/CF 超时上限之下）。
- **at-least-once**：任务可能被投递多次。客户端必须按 `task_id`
  在进程内去重：自动任务只执行一次、重投只重传旧结果；人工任务
  只提示一次。命令本身也应尽量写成可重入的。

### POST /tasks/result —— 交结果

```json
{"task_id": "task-xxx", "ok": true, "output": "..."}
```

- 未知 task_id → 404。
- 网关侧截断输出 200KB（客户端侧先截 100KB）。
- 人工回填的结果：`output` 首行加 `[manual]` 标注。

### GET /tasks/result/<task_id> —— 大脑轮询取结果

Response：`{"task_id": ..., "status": "queued|in_flight|done", "result": {...}|null}`。
`result = {"ok": bool, "output": str, "finished_at": ts}`。未知/过期 → 404。

长时间停在 `in_flight` 且客户端在线时，通常意味着这是一个等恩公
手动执行的 `needs_root` 任务（网关没有中间状态，不要拿假结果去
占位，那会把任务标死）。

### GET /health

原有字段不动，`queued_tasks` = 未 done 的任务数。

## 生命周期常量

- `TASK_TTL = 7200`：任务/结果 2 小时后遗忘。人工任务必须在这个
  窗口内完成回填，过期作废、由提交方重新下发。
- `TASK_REDELIVER = 900`：in_flight 15 分钟无结果则重投。
- `TASK_POLL_HOLD_MAX = 50`：单次长轮询最长持有。
- 客户端 shell 单条执行超时 300 秒：强杀、退出码记 -1、`ok=false`
  交结果，不悬挂。人工任务无执行超时（受 TASK_TTL 约束）。

## 人工执行约定（needs_root）

1. 客户端收到 `needs_root=true`：不执行、不试运行。写本地审计日志
   （`manual_pending`），终端醒目打印命令全文与回填方法，并把待办
   存入 `~/.muse-python/pending.json`（重启后恢复提示）。
2. 恩公在自己的终端执行（sudo 密码只出现在他的终端；客户端永不
   接触密码、永不代跑 sudo），把完整输出粘回客户端。
3. 客户端以同一 `task_id` POST /tasks/result，output 首行 `[manual]`；
   审计记 `manual_result`。恩公选择跳过时回 `ok=false` 并注明未执行。
4. 提交方（云端沐丝）下发 needs_root 任务时，必须同时在聊天里通知
   恩公——客户端提示保证记录完整，聊天通知保证他不会干等。

## 本地客户端行为（client/muse_python.py）

1. 长轮询 `/tasks/poll?target=<name>`，断线/报错则 5 秒后重试，
   循环不退出。Ctrl-C 退出即急停（收不到任何命令）。
2. 自动任务（`kind=shell` 且 `needs_root=false`）：登录 shell
   （`/bin/zsh -lc`，退 `/bin/bash -lc`、`/bin/sh -c`）在用户主目录
   执行，stdin 接 DEVNULL；stdout+stderr 合并（stderr 行加 `[stderr]`
   前缀），超 100KB 截断，POST /tasks/result。交结果失败则记日志，
   任务稍后会被重投（去重保证不重复执行）。
3. 人工任务（`needs_root=true`）：按"人工执行约定"处理。
4. 不支持的 kind：回 `ok=false` 说明不支持并标 done，审计留痕。
5. **审计日志是硬要求**：每一步先写 `~/.muse-python/audit.jsonl`
   再动作。字段：`ts, event, task_id, target, kind, needs_root,
   source(auto|manual), command, ok, exit_code, output, note`。
   事件：`command / result / manual_pending / manual_result /
   client_start / client_stop / error`。终端同时打印一行人类可读摘要。
6. token 来源优先级：`--token` > 环境变量 `MP_TOKEN` >
   `~/.muse-pipe-token`（0600）。绝不打印 token。

## 调试用 curl（token 从文件读，绝不 echo）

```bash
T=$(cat ~/workspace/muse-pipe/.mp_token); BASE=https://www.reinhand.com/muse-pipe
# 提交一条自动 shell 任务
curl -sk -X POST $BASE/tasks/submit -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"target":"m1","kind":"shell","task":"hostname && pwd"}'
# 提交一条人工任务（needs_root）
curl -sk -X POST $BASE/tasks/submit -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"target":"m1","kind":"shell","needs_root":true,"task":"sudo mdutil -E /"}'
# 模拟客户端拿任务
curl -sk "$BASE/tasks/poll?target=m1&timeout=5" -H "Authorization: Bearer $T"
# 模拟客户端交结果
curl -sk -X POST $BASE/tasks/result -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"task_id":"task-xxx","ok":true,"output":"..."}'
# 大脑取结果
curl -sk $BASE/tasks/result/task-xxx -H "Authorization: Bearer $T"
```

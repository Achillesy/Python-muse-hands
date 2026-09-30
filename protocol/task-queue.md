# 任务队列协议（网关 /tasks/*）

实现位置：`FastAPI-muse-pipe` 仓库的 `muse_server.py`（随网关 push-to-deploy 上线）。
本文件是给实现者（云端沐丝、本地 Hermes、排障时的人）看的协议说明。

## 角色

- **提交方**：云端沐丝（大脑）。唯一的任务发起方和结果验证方。
- **网关**：哑队列，只存取，不理解任务内容。
- **执行方**：`client/local_client.py`，哑执行器。拿到任务就跑，跑完交回，不做判断。

## 认证

全程 `Authorization: Bearer <MP_TOKEN>`，和网关现有接口同一套密钥。
MP_TOKEN 永不进 git、进 Actions 日志、进聊天正文。

## 端点

### POST /tasks/submit —— 提交任务

Request body：

```json
{
  "target": "pc",
  "kind": "hermes",
  "task": "只读检查 ComfyUI :8188 的 system_stats",
  "skill": "comfyui",
  "max_turns": 60,
  "provider": "deepseek"
}
```

- `target` 必填：`pc` / `m1` / …，客户端启动时用 `--target` 认领。
- `task` 必填：任务正文，空则 400。
- `skill` 可选：传给 `hermes chat -s`。
- `max_turns` 默认 60，`provider` 默认 deepseek，`kind` 默认 hermes。

Response：`{"task_id": "task-<12位hex>", "status": "queued"}`。
提交即唤醒正在长轮询的客户端。

### GET /tasks/poll?target=pc&timeout=50 —— 客户端长轮询拿任务

- 返回该 target 的待办任务：`status=queued` 的，以及 `in_flight` 超过
  15 分钟没结果的（视为执行方已死，重投）。
- 返回的任务即被标记 `in_flight`（`delivered_at=now`）。
- 任务单项格式：`{"task_id","kind","task","skill","max_turns","provider"}`。
- 空等最多 50 秒（必须卡在 nginx/CF 超时上限之下）。
- **at-least-once**：任务可能被投递多次。Hermes 任务应写成可重入的，
  或提交方按 `task_id` 去重。

### POST /tasks/result —— 交结果

```json
{"task_id": "task-xxx", "ok": true, "output": "..."}
```

- 未知 task_id → 404。
- 网关侧截断输出 200KB（客户端侧先截 100KB）。

### GET /tasks/result/<task_id> —— 大脑轮询取结果

Response：`{"task_id": ..., "status": "queued|in_flight|done", "result": {...}|null}`。
`result = {"ok": bool, "output": str, "finished_at": ts}`。未知/过期 → 404。

### GET /health

原有字段不动，新增 `queued_tasks`（未 done 的任务数）。

## 生命周期常量

- `TASK_TTL = 7200`：任务/结果 2 小时后遗忘。
- `TASK_REDELIVER = 900`：in_flight 15 分钟无结果则重投。
- `TASK_POLL_HOLD_MAX = 50`：单次长轮询最长持有。
- 客户端 `hermes` 单次执行默认上限 30 分钟（`--hermes-timeout` / `MP_HERMES_TIMEOUT` 可调）；
  超时杀进程并以 `ok=false` 交结果，不悬挂。

## 调试用 curl（token 从文件读，绝不 echo）

```bash
T=$(cat ~/workspace/muse-pipe/.mp_token); BASE=https://www.reinhand.com/muse-pipe
curl -sk -X POST $BASE/tasks/submit -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"target":"pc","kind":"hermes","task":"test","skill":"comfyui","max_turns":60}'
curl -sk "$BASE/tasks/poll?target=pc&timeout=5" -H "Authorization: Bearer $T"
curl -sk -X POST $BASE/tasks/result -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"task_id":"task-xxx","ok":true,"output":"..."}'
curl -sk $BASE/tasks/result/task-xxx -H "Authorization: Bearer $T"
```

## 本地客户端行为（client/local_client.py）

1. 长轮询 `/tasks/poll?target=<name>`，断线/报错则 5 秒后重试，循环不退出。
2. 拿到任务 → 写 `~/.muse-pipe/tasks/<task_id>.md`（带注释头）→
   `hermes chat -Q --query-file <file> [-s <skill>] --yolo --max-turns <n> --source tool --provider <p>`
   （flag 以本机 `hermes chat --help` 为准，`--dry-run` 可只打印不执行）。
3. 抓 stdout+stderr（utf-8/replace 防 Windows 编码炸），超 100KB 截断，
   POST 到 `/tasks/result`。交结果失败则记日志，任务稍后会被重投。
4. token 来源优先级：`--token` > 环境变量 `MP_TOKEN` > `~/.muse-pipe-token`（0600）。
   绝不打印 token。

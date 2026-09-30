# Python-muse-hands

沐丝的双手。让云端大脑（Muse）经由 muse-pipe VPS 网关，向用户本地机器上的
Hermes agent 派发任务并取回结果——恩公只在聊天里下一次命令，不再当传话筒。

## 架构

```
恩公（浏览器聊天，下一次命令）
  → 我（大脑）：判断是否需要本地执行，拆子任务
  → VPS 网关 /tasks/submit（FastAPI-muse-pipe，Bearer MP_TOKEN）
  → 本地客户端 client/local_client.py（WSL2/macOS/Windows 常驻，长轮询）
  → hermes chat -Q --query-file（本地执行）
  → 结果回 VPS → 我轮询拿到 → 验证 → 回复恩公
```

## 技术栈

**Python 为主，FastAPI 只留在 VPS 网关**（按运行位置分工，2026-09-30 定案）：

- 用户机器上的客户端：纯标准库 Python，零依赖，拷过去就能跑。
- VPS 网关：FastAPI（已部署，push-to-deploy 通畅），任务队列住在那儿。
- wasm 数字人：跑在访问者浏览器里；它的 pipeline（视频→签名 JSON）是 Python，
  正好成为本链路的一种任务类型，派给有 GPU 的 PC 跑；展示站是静态文件，
  nginx 直接 serve。

## 仓库结构

```
README.md               本文件：项目主页
DESIGN.md               设计方案（写给云端沐丝自己看的，下次直接照此开干）
docs/discussion-log.md  讨论纪要
protocol/task-queue.md  网关任务队列协议（给实现者看的）
client/local_client.py  本地客户端正本（纯标准库，多系统）
```

## 状态（2026-09-30）

- 网关 `/tasks/*` 接口已在 FastAPI-muse-pipe 的 main 上线（commit 3aedb7f），
  `/health` 验证通过；四个新接口尚未实测。
- 客户端写完，没在任何机器上跑过。
- 设计方案草稿完成，7 项待定事项等恩公逐项拍板（见 DESIGN.md §6）。

## 相关项目

- [FastAPI-muse-pipe](https://github.com/Achillesy/FastAPI-muse-pipe) —— VPS 网关，
  可部署；`/tasks/*` 队列住在那儿，随它一起上线。
- Qt_DH_live（私有）—— wasm 数字人，将来它的 pipeline 会成为本链路的任务类型。

## Roadmap

1. 四个新接口 curl 实测（不需要客户端）。
2. WSL 跑 client，第一次真实 Hermes 任务（只读：ComfyUI 状态检查）。
3. 待定事项逐项定案。
4. 文件回传（Hermes 生成的图片/模型）。
5. 远期：数字人当语音入口（说话→ASR→任务队列→hands 干活→TTS 念结果）。

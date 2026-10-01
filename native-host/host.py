#!/usr/bin/env python3
# muse-hands 本地 host（Chrome Native Messaging）
#
# Chrome 通过 stdio 把它拉起：扩展发来的消息是 4 字节小端长度前缀
# + UTF-8 JSON，host 同格式回。host 不监听任何网络端口。
#
# 安全约定：host 只被白名单扩展 ID 唤起（见 install.py 的
# allowed_origins）；密码与提权不经过这里——需要提权时由命令本身
# 触发系统 UAC，host 不接收、不保存任何口令。

import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time

LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "host.log")
DEFAULT_TIMEOUT = 120  # 秒；M1 先给保守值，截断/超时策略 M3 定型


def log(line):
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + line + "\n")
    except OSError:
        pass


def read_message():
    raw_len = sys.stdin.buffer.read(4)
    if not raw_len:
        return None
    (length,) = struct.unpack("<I", raw_len)
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode("utf-8"))


def send_message(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def decode_output(raw):
    if not raw:
        return ""
    for enc in ("utf-8", "gbk"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def shell_argv(cmd):
    if sys.platform == "win32":
        return ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", cmd]
    if os.path.exists("/bin/zsh"):
        return ["/bin/zsh", "-lc", cmd]
    return ["/bin/bash", "-lc", cmd]


def run_exec(msg):
    cmd = msg.get("cmd", "")
    try:
        timeout = int(msg.get("timeout") or DEFAULT_TIMEOUT)
    except (TypeError, ValueError):
        timeout = DEFAULT_TIMEOUT
    rid = msg.get("id")
    started = time.time()
    error = None
    proc = subprocess.Popen(
        shell_argv(cmd), stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    box = {}

    def wait():
        try:
            box["out"], box["err"] = proc.communicate()
        except Exception:
            box["out"], box["err"] = b"", b""

    t = threading.Thread(target=wait, daemon=True)
    t.start()
    while t.is_alive():
        remaining = timeout - (time.time() - started)
        if remaining <= 0:
            proc.kill()
            t.join(5)
            error = "timeout after %ss" % timeout
            break
        t.join(min(20, remaining))
        if t.is_alive():
            # 约每 20 秒报一次活，防止上层长连接被当闲置掐断
            send_message(
                {
                    "type": "progress",
                    "id": rid,
                    "elapsed_ms": int((time.time() - started) * 1000),
                }
            )
    exit_code = proc.returncode if proc.returncode is not None else -1
    stdout = decode_output(box.get("out"))
    stderr = decode_output(box.get("err"))
    duration_ms = int((time.time() - started) * 1000)
    log("exec id=%s exit=%s ms=%s cmd=%r" % (msg.get("id"), exit_code, duration_ms, cmd[:200]))
    res = {
        "type": "result",
        "id": msg.get("id"),
        "hostname": socket.gethostname(),
        "ok": exit_code == 0 and error is None,
        "exit_code": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "duration_ms": duration_ms,
    }
    if error:
        res["error"] = error
    return res


def handle(msg):
    t = msg.get("type")
    if t == "ping":
        return {
            "type": "pong",
            "id": msg.get("id"),
            "hostname": socket.gethostname(),
            "platform": sys.platform,
        }
    if t == "exec":
        return run_exec(msg)
    return {"type": "error", "id": msg.get("id"), "error": "unknown type: %r" % (t,)}


def main():
    log("host started platform=%s hostname=%s" % (sys.platform, socket.gethostname()))
    while True:
        msg = read_message()
        if msg is None:
            break
        try:
            send_message(handle(msg))
        except Exception as e:  # 单条消息出错不能把 host 带走
            log("handle error: %r" % (e,))
            try:
                send_message({"type": "error", "id": msg.get("id"), "error": str(e)})
            except Exception:
                break
    log("host exit")


if __name__ == "__main__":
    main()

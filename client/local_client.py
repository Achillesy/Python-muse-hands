#!/usr/bin/env python3
"""muse-pipe local client: multi-OS bridge between the VPS task queue and a local Hermes agent.

Runs on the user's own machines: WSL2/Linux, macOS, or native Windows with
Python 3.8+. Stdlib only -- no `pip install` needed.

Loop:
    1. long-poll  GET <base>/tasks/poll?target=<name>   (Bearer <MP_TOKEN>)
    2. for each task: write it to a file, run
           hermes chat -Q --query-file <file> [-s <skill>] --yolo
                   --max-turns <n> --source tool --provider <p>
       (flags follow the Hermes CLI docs; verify with `hermes chat --help`
       if your Hermes version differs)
    3. POST the captured output to <base>/tasks/result

Configuration, in order of precedence: CLI flags > environment > ~/.muse-pipe-client.env

    MP_TOKEN / --token     gateway bearer token (required; never printed)
    MP_BASE  / --base      gateway base URL, default https://www.reinhand.com/muse-pipe
    MP_TARGET/ --target    this machine's target name, default "pc"
    MP_HERMES_TIMEOUT      max seconds per hermes run, default 1800

Usage:
    python3 local_client.py --target pc          # token from env MP_TOKEN or ~/.muse-pipe-token
    python3 local_client.py --target m1 --token <token>
    python3 local_client.py --dry-run            # poll and print tasks, don't run hermes

The token file (~/.muse-pipe-token) should be chmod 600. It is never committed
anywhere and never echoed to logs.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_BASE = "https://www.reinhand.com/muse-pipe"
POLL_TIMEOUT = 50          # long-poll hold; must stay under proxy/CF limits
RETRY_SLEEP = 5            # wait between polls after an error
OUTPUT_CAP = 100_000       # truncate hermes output beyond this (gateway caps too)


def log(*parts):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}]", *parts, flush=True)


def load_dotenv(path: Path):
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


class Gateway:
    def __init__(self, base: str, token: str):
        self.base = base.rstrip("/")
        self.token = token

    def _req(self, method: str, path: str, body=None, timeout=70):
        data = None
        headers = {"Authorization": f"Bearer {self.token}"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base + path, data=data,
                                     headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"HTTP {e.code} on {path}: {e.read()[:200]!r}")

    def poll_tasks(self, target: str):
        q = urllib.parse.urlencode({"target": target, "timeout": POLL_TIMEOUT})
        return self._req("GET", f"/tasks/poll?{q}", timeout=POLL_TIMEOUT + 15)

    def post_result(self, task_id: str, ok: bool, output: str):
        return self._req("POST", "/tasks/result",
                         {"task_id": task_id, "ok": ok, "output": output})


def run_hermes(task: dict, workdir: Path, hermes_bin: str,
               hermes_timeout: int, dry_run: bool) -> tuple:
    """Run one task through the local Hermes CLI. Returns (ok, output)."""
    task_id = task["task_id"]
    task_file = workdir / f"{task_id}.md"
    header = (f"<!-- muse-pipe task {task_id} | kind={task.get('kind')} "
              f"| skill={task.get('skill')} | max_turns={task.get('max_turns')} -->\n\n")
    task_file.write_text(header + task["task"] + "\n", encoding="utf-8")

    cmd = [hermes_bin, "chat", "-Q", "--query-file", str(task_file)]
    if task.get("skill"):
        cmd += ["-s", str(task["skill"])]
    cmd += ["--yolo", "--max-turns", str(task.get("max_turns") or 60),
            "--source", "tool", "--provider", str(task.get("provider") or "deepseek")]
    log("exec:", " ".join(cmd))
    if dry_run:
        return True, "[dry-run] task not executed"

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              encoding="utf-8", errors="replace",
                              timeout=hermes_timeout)
        output = (proc.stdout or "") + ("[stderr]\n" + proc.stderr if proc.stderr else "")
        ok = proc.returncode == 0
        if not ok:
            output = f"[hermes exit code {proc.returncode}]\n" + output
    except FileNotFoundError:
        return False, f"hermes binary not found: {hermes_bin} (is it on PATH?)"
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or "") if isinstance(e.stdout, str) else ""
        return False, (f"[timeout after {hermes_timeout}s, process killed]\n" + out)
    except Exception as e:  # noqa: BLE001 - report, don't crash the loop
        return False, f"[client error: {type(e).__name__}: {e}]"

    if len(output) > OUTPUT_CAP:
        output = output[:OUTPUT_CAP] + "\n...[truncated by local client]"
    return ok, output.strip() or "[empty output]"


def resolve_token(args) -> str:
    if args.token:
        return args.token
    tok = os.environ.get("MP_TOKEN", "").strip()
    if tok:
        return tok
    tokfile = Path.home() / ".muse-pipe-token"
    if tokfile.is_file():
        return tokfile.read_text(encoding="utf-8").strip()
    raise SystemExit(
        "Missing gateway token. Provide it via --token, env MP_TOKEN, "
        "or a 0600 file at ~/.muse-pipe-token (copy MP_TOKEN from your .env).")


def main():
    ap = argparse.ArgumentParser(description="muse-pipe local client (VPS -> hermes)")
    ap.add_argument("--target", default=os.environ.get("MP_TARGET", "pc"))
    ap.add_argument("--base", default=os.environ.get("MP_BASE", DEFAULT_BASE))
    ap.add_argument("--token", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--hermes-bin", default=os.environ.get("MP_HERMES_BIN") or "hermes")
    ap.add_argument("--hermes-timeout", type=int,
                    default=int(os.environ.get("MP_HERMES_TIMEOUT", "1800")))
    args = ap.parse_args()

    load_dotenv(Path.home() / ".muse-pipe-client.env")
    # re-apply env defaults that may have come from the dotenv file
    if args.target == "pc":
        args.target = os.environ.get("MP_TARGET", "pc")
    if args.base == DEFAULT_BASE:
        args.base = os.environ.get("MP_BASE", DEFAULT_BASE)

    token = resolve_token(args)
    gw = Gateway(args.base, token)

    hermes_bin = args.hermes_bin
    if not args.dry_run and not shutil.which(hermes_bin):
        log(f"WARNING: {hermes_bin!r} not on PATH; tasks will fail until hermes is installed.")

    workdir = Path.home() / ".muse-pipe" / "tasks"
    workdir.mkdir(parents=True, exist_ok=True)

    log(f"local client up: base={args.base} target={args.target} "
        f"hermes={hermes_bin} dry_run={args.dry_run}")
    while True:
        try:
            resp = gw.poll_tasks(args.target)
        except Exception as e:  # noqa: BLE001 - network blips must not kill the loop
            log("poll error:", e, f"-- retry in {RETRY_SLEEP}s")
            time.sleep(RETRY_SLEEP)
            continue
        tasks = resp.get("tasks") or []
        for task in tasks:
            tid = task.get("task_id", "?")
            log(f"got task {tid} (skill={task.get('skill')})")
            ok, output = run_hermes(task, workdir, hermes_bin,
                                    args.hermes_timeout, args.dry_run)
            try:
                gw.post_result(tid, ok, output)
                log(f"result posted for {tid} ok={ok} ({len(output)} chars)")
            except Exception as e:  # noqa: BLE001
                log(f"FAILED to post result for {tid}:", e,
                    "-- will be redelivered later")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped.", flush=True)

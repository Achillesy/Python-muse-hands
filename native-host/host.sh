#!/bin/sh
# muse-hands host 启动器（macOS / Linux）
# 优先用项目根目录 .venv 的解释器，没有时退回系统 python3。
DIR=$(dirname "$0")
if [ -x "$DIR/../.venv/bin/python" ]; then
  exec "$DIR/../.venv/bin/python" "$DIR/host.py" "$@"
fi
exec python3 "$DIR/host.py" "$@"

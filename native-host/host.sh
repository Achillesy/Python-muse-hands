#!/bin/sh
# muse-hands host 启动器（macOS / Linux）
exec python3 "$(dirname "$0")/host.py" "$@"

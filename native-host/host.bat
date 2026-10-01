@echo off
rem muse-hands host 启动器（Windows，Chrome 通过它拉起 host.py）。
rem 若本机没有 py 启动器，把下一行的 py -3 换成 python 即可。
py -3 "%~dp0host.py" %*

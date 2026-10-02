@echo off
rem webai-hands host 安装（Windows）：双击运行一次即可。
cd /d %~dp0
py -3 install.py
if errorlevel 1 python install.py
echo.
pause

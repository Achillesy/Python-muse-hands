@echo off
rem muse-hands host 启动器（Windows，Chrome 通过它拉起 host.py）。
rem 优先用项目根目录 .venv 的解释器（将来装第三方库就靠它），
rem 还没有 venv 时退回系统 Python 的 py 启动器。
set "VENV_PY=%~dp0..\.venv\Scripts\python.exe"
if exist "%VENV_PY%" (
  "%VENV_PY%" "%~dp0host.py" %*
) else (
  py -3 "%~dp0host.py" %*
)

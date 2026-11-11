@echo off
REM 渲染 diagrams\ 下所有 .mmd 为 PNG
REM 用法: diagrams\render.bat
setlocal

cd /d "%~dp0\.."

if not exist "diagrams\out" mkdir "diagrams\out"

where node >nul 2>nul
if errorlevel 1 (
  echo 错误: 未找到 node，请先安装 Node.js
  exit /b 1
)

echo 开始渲染 .mmd -^> PNG ...
for %%f in (diagrams\*.mmd) do (
  echo   -^> %%~nf
  call npx --yes @mermaid-js/mermaid-cli -i "%%f" -o "diagrams\out\%%~nf.png" -w 2400 -b white
)

echo 完成，输出目录: diagrams\out
dir /b diagrams\out
endlocal

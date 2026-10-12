@echo off
chcp 65001 >nul
title RAG 一键启动

rem 支持以参数方式在独立窗口中运行前端或后端
if "%~1"=="frontend" goto frontend
if "%~1"=="backend" goto backend

echo ==========================================
echo   RAG 项目一键启动
echo   前端: http://localhost:5173
echo   后端: http://127.0.0.1:8000
echo ==========================================
echo.

rem 先启动后端（前端通过代理访问后端接口）
start "RAG Backend" cmd /k "%~f0" backend
rem 稍等，避免两个窗口同时抢占
timeout /t 2 /nobreak >nul
start "RAG Frontend" cmd /k "%~f0" frontend

echo 已分别在两个窗口中启动前后端，关闭窗口即可停止服务。
echo.
pause
exit /b

:frontend
cd /d "%~dp0frontend"
echo [前端] 安装依赖...
call npm install
echo [前端] 启动开发服务 http://localhost:5173
call npm run dev
exit /b

:backend
cd /d "%~dp0backend"
echo [后端] 安装依赖...
call uv sync
if not exist .env (
  echo [后端] 未发现 .env，正在从 .env.example 复制...
  copy .env.example .env >nul
)
echo [后端] 启动服务 http://127.0.0.1:8000
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
exit /b

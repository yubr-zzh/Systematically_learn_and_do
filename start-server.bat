@echo off
chcp 65001 >nul
cd /d "%~dp0systematic-learning-tool-design"

echo ========================================
echo   Systematically Learn and Do - 启动
echo ========================================
echo.

echo [1/3] 安装依赖...
npm install
if errorlevel 1 (
    echo 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [2/3] 启动后端服务器...
echo    后端地址: http://localhost:3001
echo    按 Ctrl+C 停止服务器
echo.

npm run server

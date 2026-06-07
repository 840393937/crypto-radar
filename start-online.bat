@echo off
echo.
echo  ====================================
echo   加密雷达 - 启动公网访问
echo  ====================================
echo.
echo  [1/2] 启动本地服务器...
cd /d "%~dp0"
start /b python -m http.server 8080
timeout /t 2 >nul

echo  [2/2] 创建公网隧道...
echo.
echo  等待隧道建立(约15秒)...
echo.

ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:8080 serveo.net

echo.
echo  隧道已关闭
pause

@echo off
echo.
echo  ====================================
echo   加密雷达 - 本地访问
echo  ====================================
echo.
echo  浏览器打开: http://localhost:8080
echo.
cd /d "%~dp0"
python -m http.server 8080
pause

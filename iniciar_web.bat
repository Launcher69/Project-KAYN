@echo off
title Servidor Web - Wiki Multiverso
cd /d "%~dp0"

echo ===================================================
echo   Iniciando Servidor Web Local para la Wiki...
echo ===================================================
echo.

:: Abre automáticamente la web en tu navegador predeterminado
start http://localhost:8000/web/

:: Arranca el servidor de Python en el puerto 8000
python -m http.server 8000

pause
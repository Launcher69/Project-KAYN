@echo off
title Bot de Discord - Wiki Multiverso
cd /d "%~dp0"

echo ===================================================
echo   Iniciando Bot de Discord (Wiki Multiverso)...
echo ===================================================
echo.

:: Ejecuta el archivo principal del bot
python main.py

:: Si el bot se detiene o falla, mantiene la ventana abierta para ver el error
echo.
echo El bot se ha detenido.
pause
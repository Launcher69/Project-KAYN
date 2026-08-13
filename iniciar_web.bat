@echo off
title Servidor Web - Wiki Multiverso
cd /d "%~dp0Web"

echo ===================================================
echo   Iniciando Servidor Web Local para la Wiki...
echo ===================================================
echo.

:: Abre automáticamente la web en tu navegador predeterminado
start http://localhost:3000/

:: Arranca el servidor de Node.js/Vite en el puerto 3000
npm run dev

pause
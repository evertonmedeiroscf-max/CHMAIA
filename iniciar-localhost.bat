@echo off
rem Sobe o sistema em http://localhost:3000 para testar as atualizacoes
rem antes de publicar. Feche esta janela para desligar o servidor.
title Chef Hilana Maia - localhost:3000
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
start "" cmd /c "timeout /t 8 >nul && start http://localhost:3000"
call npm run dev
pause

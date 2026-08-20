@echo off
setlocal

set "VERBO_PORT=4173"
set "VERBO_ROOT=%~dp0"
set "VERBO_RUNTIME_PYTHON=C:\Users\ismae\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$port = %VERBO_PORT%; $root = '%VERBO_ROOT%'; $python = '%VERBO_RUNTIME_PYTHON%'; $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if (-not $listener) { if (Test-Path $python) { Start-Process -WindowStyle Hidden -FilePath $python -ArgumentList @('-m','http.server',$port,'--directory',($root + 'web')) } else { Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',($root + 'Servidor-Verbo-Web.ps1'),'-Port',$port,'-Root',($root + 'web')) }; Start-Sleep -Seconds 2 }; Start-Process ('http://localhost:' + $port + '/')"

endlocal

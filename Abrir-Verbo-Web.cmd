@echo off
setlocal

set "VERBO_PORT=4173"
set "VERBO_ROOT=%~dp0"
set "VERBO_RUNTIME_PYTHON=C:\Users\ismae\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

powershell -NoProfile -WindowStyle Hidden -Command "$port = %VERBO_PORT%; $root = '%VERBO_ROOT%'; $python = '%VERBO_RUNTIME_PYTHON%'; if (-not (Test-Path $python)) { $python = (Get-Command python -ErrorAction SilentlyContinue).Source }; if (-not $python) { exit 1 }; $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if (-not $listener) { Start-Process -WindowStyle Hidden -FilePath $python -ArgumentList @('-m','http.server',$port,'--directory',($root + 'web')); Start-Sleep -Seconds 2 }; Start-Process ('http://localhost:' + $port + '/')"

endlocal

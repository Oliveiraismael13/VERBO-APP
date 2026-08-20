@echo off
setlocal

set "VERBO_PORT=4173"
set "VERBO_ROOT=%~dp0"
set "VERBO_RUNTIME_PYTHON=C:\Users\ismae\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$port = %VERBO_PORT%; $root = '%VERBO_ROOT%'; $python = '%VERBO_RUNTIME_PYTHON%'; $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue; $apiListener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $apiListener -and $pnpm) { Start-Process -WindowStyle Hidden -WorkingDirectory ($root + 'mobile') -FilePath 'cmd.exe' -ArgumentList @('/c','pnpm dev -- --port 3000') }; $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if (-not $listener) { if (Test-Path $python) { Start-Process -WindowStyle Hidden -FilePath $python -ArgumentList @('-m','http.server',$port,'--directory',($root + 'web')) } else { Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',($root + 'Servidor-Verbo-Web.ps1'),'-Port',$port,'-Root',($root + 'web')) }; Start-Sleep -Seconds 3 }; Start-Process ('http://localhost:' + $port + '/')"

endlocal

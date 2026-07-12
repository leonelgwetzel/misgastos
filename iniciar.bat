@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set APP_URL=http://localhost:3000

echo.
echo  misgastos - iniciando...
echo.

REM Si el servidor ya responde, solo abrir el navegador
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%APP_URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
  echo  Servidor ya activo en %APP_URL%
  start "" "%APP_URL%"
  exit /b 0
)

REM PostgreSQL via Docker (solo el servicio db)
where docker >nul 2>&1
if %errorlevel% equ 0 (
  echo  Levantando PostgreSQL...
  docker compose -f docker-compose.dev.yml up db -d
  if errorlevel 1 (
    echo  AVISO: no se pudo iniciar Postgres con Docker.
    echo  Si ya tenes la base corriendo, podes ignorar esto.
  ) else (
    echo  Esperando base de datos...
    timeout /t 4 /nobreak >nul
  )
) else (
  echo  AVISO: Docker no encontrado. Asegurate de que Postgres este disponible.
)

if not exist "node_modules\" (
  echo  Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo  Error al instalar dependencias.
    pause
    exit /b 1
  )
)

echo  Iniciando servidor...
start "misgastos - servidor" cmd /k "cd /d \"%~dp0\" && npm run dev"

echo  Esperando que la app responda...
set tries=0
:waitloop
set /a tries+=1
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%APP_URL%' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto openbrowser
if !tries! geq 45 (
  echo.
  echo  No se pudo conectar despues de 45 segundos.
  echo  Revisa la ventana "misgastos - servidor" por errores.
  echo  URL: %APP_URL%
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto waitloop

:openbrowser
start "" "%APP_URL%"
echo.
echo  Listo. Servidor en %APP_URL%
echo  Para detenerlo, cerra la ventana "misgastos - servidor".
echo.
timeout /t 4 /nobreak >nul
endlocal
exit /b 0

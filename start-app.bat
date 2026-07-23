@echo off
echo Iniciando PostgreSQL...
"C:\Users\PabloPlazaTravieso\postgresql-local\pgsql\bin\pg_ctl.exe" -D "C:\Users\PabloPlazaTravieso\postgresql-local\data" -l "C:\Users\PabloPlazaTravieso\postgresql-local\logfile.txt" -o "-p 5432" start

echo Iniciando backend (NestJS)...
start "Backend - NestJS" cmd /k "cd /d c:\dev\moodle-admin-instances\backend && npx ts-node -r tsconfig-paths/register src-nest/main.ts"

echo Iniciando frontend (Vite)...
start "Frontend - Vite" cmd /k "cd /d c:\dev\moodle-admin-instances\frontend && npm run dev"

echo.
echo Todo iniciado. Abre http://localhost:5173 en tu navegador en unos segundos.
pause

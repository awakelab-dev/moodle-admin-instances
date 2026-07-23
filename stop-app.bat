@echo off
echo Deteniendo PostgreSQL...
"C:\Users\PabloPlazaTravieso\postgresql-local\pgsql\bin\pg_ctl.exe" -D "C:\Users\PabloPlazaTravieso\postgresql-local\data" stop

echo.
echo Postgres detenido. Cierra manualmente las ventanas "Backend - NestJS" y "Frontend - Vite" (o Ctrl+C dentro de ellas).
pause

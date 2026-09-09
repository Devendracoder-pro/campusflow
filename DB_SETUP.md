# CampusFlow database setup

Use this after PostgreSQL finishes installing on Windows.

## 1. Verify PostgreSQL

Open a new PowerShell window and run:

```powershell
psql --version
Get-Service postgresql* | Select-Object Name, Status
```

The service should be `Running`. If it is stopped, start the matching service from the Windows Services app or with an administrator PowerShell:

```powershell
Start-Service postgresql-x64-15
```

The service name may contain another installed PostgreSQL version.

## 2. Create the application database

Connect with the password chosen during PostgreSQL installation:

```powershell
psql -U postgres -h localhost
```

Run these SQL statements:

```sql
CREATE USER campusflow WITH PASSWORD 'choose-a-strong-local-password';
CREATE DATABASE campusflow OWNER campusflow;
\q
```

If the user or database already exists, do not run the corresponding `CREATE` statement again.

## 3. Configure CampusFlow

Edit the project `.env` file, not `.env.example`:

```env
DATABASE_URL=postgres://campusflow:choose-a-strong-local-password@localhost:5432/campusflow
DB_POOL_MAX=10
```

Use URL encoding for special password characters. For example, `@` becomes `%40`.

## 4. Run the schema migration

From the project folder:

```powershell
npm run migrate
```

Expected output:

```text
Applied 001_initial.sql
Database migrations complete.
```

Running the command again is safe; already-applied migrations are skipped.

## 5. Verify the application connection

Restart the server so it reads the new environment:

```powershell
npm start
```

Then check:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/health -UseBasicParsing
```

A connected database reports:

```json
{"status":"ok","database":{"configured":true,"connected":true}}
```

## Common issues

- `psql is not recognized`: open a new terminal, or add PostgreSQL's `bin` directory to PATH.
- `password authentication failed`: use the password selected during installation.
- `database does not exist`: create the `campusflow` database in step 2.
- `ECONNREFUSED`: start the PostgreSQL service and confirm port `5432`.
- `EADDRINUSE: 3000`: the app is already running; use the existing browser tab or stop the old Node process before starting another one.

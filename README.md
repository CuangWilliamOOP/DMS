# DMS

This repository contains the Document Management System.

## Creating the database

The repository does not include the Django SQLite database file. After cloning the project, create it by applying the migrations:

```bash
cd backend
python manage.py migrate
```

This will generate `backend/db.sqlite3`.

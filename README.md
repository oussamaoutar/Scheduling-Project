# Industrial Scheduling Backend

Backend Django REST pour une application d’ordonnancement industriel.

## Stack
- Python
- Django
- Django REST Framework
- SQLite

## Installation

### 1. Activer l’environnement virtuel
Sous Windows CMD :

```cmd
venv\Scripts\activate
```

### 2. Installer les dépendances

```cmd
pip install -r requirements\dev.txt
```

### 3. Aller dans le dossier source

```cmd
cd src
```

### 4. Appliquer les migrations

```cmd
python manage.py migrate
```

### 5. Créer un superuser

```cmd
python manage.py createsuperuser
```

### 6. Lancer le serveur

```cmd
python manage.py runserver
```

## Seeder les données démo

Depuis `src` :

```cmd
python manage.py seed_demo_data
```

## Documentation API
- Swagger: `http://127.0.0.1:8000/api/docs/`
- Healthcheck: `http://127.0.0.1:8000/api/health/`

## Endpoints principaux

### Machines
- `GET /api/machines/`
- `POST /api/machines/`

### Jobs
- `GET /api/jobs/`
- `POST /api/jobs/`

### Operations
- `GET /api/jobs/operations/`
- `POST /api/jobs/operations/`

### Scheduling runs
- `GET /api/scheduling/runs/`
- `POST /api/scheduling/runs/`
- `POST /api/scheduling/runs/{id}/execute/`

### Scheduling helper endpoints
- `GET /api/scheduling/dashboard/`
- `GET /api/scheduling/algorithms/`
- `POST /api/scheduling/compare/`
- `GET /api/scheduling/runs/{id}/summary/`
- `GET /api/scheduling/runs/{id}/kpis/`
- `GET /api/scheduling/runs/{id}/gantt/`

## Remarque frontend
Les endpoints de liste sont paginés.  
Le frontend doit lire les données dans la clé `results`.

## Mode local
Le backend est configuré pour un usage local, avec `API_ALLOW_ANY=True` dans `.env`.

## Frontend handoff
See `FRONTEND_HANDOFF.md` for frontend integration details.
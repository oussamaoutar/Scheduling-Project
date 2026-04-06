# Frontend Handoff

## Backend stack
- Django
- Django REST Framework
- SQLite
- Local development only

## Important local info
- API base URL: `http://127.0.0.1:8000/api/`
- Swagger docs: `http://127.0.0.1:8000/api/docs/`
- Local mode currently uses `API_ALLOW_ANY=True`
- No deployment yet, local integration only

## Pagination
List endpoints are paginated.

Example response shape:
```json
{
  "count": 12,
  "total_pages": 1,
  "current_page": 1,
  "page_size": 20,
  "next": null,
  "previous": null,
  "results": []
}
```

Frontend must read items from `results`.

## Main endpoints

### Machines
- `GET /api/machines/`
- `POST /api/machines/`
- `GET /api/machines/{id}/`
- `PATCH /api/machines/{id}/`
- `DELETE /api/machines/{id}/`

### Jobs
- `GET /api/jobs/`
- `POST /api/jobs/`
- `GET /api/jobs/{id}/`
- `PATCH /api/jobs/{id}/`
- `DELETE /api/jobs/{id}/`

### Operations
- `GET /api/jobs/operations/`
- `POST /api/jobs/operations/`
- `GET /api/jobs/operations/{id}/`
- `PATCH /api/jobs/operations/{id}/`
- `DELETE /api/jobs/operations/{id}/`

### Schedule runs
- `GET /api/scheduling/runs/`
- `POST /api/scheduling/runs/`
- `GET /api/scheduling/runs/{id}/`
- `PATCH /api/scheduling/runs/{id}/`
- `DELETE /api/scheduling/runs/{id}/`
- `POST /api/scheduling/runs/{id}/execute/`

### Scheduling helper endpoints
- `GET /api/scheduling/dashboard/`
- `GET /api/scheduling/algorithms/`
- `POST /api/scheduling/compare/`
- `GET /api/scheduling/runs/{id}/summary/`
- `GET /api/scheduling/runs/{id}/kpis/`
- `GET /api/scheduling/runs/{id}/gantt/`

## Supported algorithms
- `spt`
- `lpt`
- `edd`
- `johnson`
- `cds`

## Constraints
- Johnson requires exactly 2 machines per job
- CDS requires at least 3 machines per job
- Johnson and CDS require the same machine order for all selected jobs

## Important frontend notes
- Durations are in minutes
- Gantt timeline values are in minutes
- Validation errors return structured error JSON
- Summary/KPIs/Gantt endpoints are easier to consume than raw run payloads

## Recommended frontend flow
1. Load dashboard
2. Load machines/jobs
3. Create or select jobs and operations
4. Create a schedule run
5. Execute the run
6. Read:
   - summary
   - kpis
   - gantt
7. Show comparison page using `/api/scheduling/compare/`
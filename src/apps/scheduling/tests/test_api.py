from django.test import TestCase
from rest_framework.test import APIClient

from apps.scheduling.models import ScheduleRun


class ScheduleRunAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_list_schedule_runs(self):
        ScheduleRun.objects.create(
            name="Run 1",
            algorithm=ScheduleRun.Algorithm.SPT,
        )

        response = self.client.get("/api/scheduling/runs/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_create_schedule_run(self):
        payload = {
            "name": "Run API",
            "algorithm": ScheduleRun.Algorithm.EDD,
            "objective": ScheduleRun.Objective.MINIMIZE_CMAX,
            "status": ScheduleRun.RunStatus.DRAFT,
        }

        response = self.client.post("/api/scheduling/runs/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ScheduleRun.objects.count(), 1)
from django.test import TestCase
from rest_framework.test import APIClient

from apps.jobs.models import Job, Operation
from apps.machines.models import Machine


class JobAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_list_jobs(self):
        Job.objects.create(
            code="J1",
            name="Job 1",
            quantity=5,
        )

        response = self.client.get("/api/jobs/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_create_job(self):
        payload = {
            "code": "J2",
            "name": "Job 2",
            "description": "",
            "quantity": 10,
            "priority": 2,
            "status": "draft",
            "is_active": True,
        }

        response = self.client.post("/api/jobs/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Job.objects.count(), 1)


class OperationAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.machine = Machine.objects.create(
            code="M1",
            name="Machine 1",
            workstation_number=1,
        )
        self.job = Job.objects.create(
            code="J1",
            name="Job 1",
            quantity=3,
        )

    def test_create_operation(self):
        payload = {
            "job": self.job.id,
            "machine": self.machine.id,
            "sequence_order": 1,
            "processing_time_minutes": 20,
            "setup_time_minutes": 5,
            "transfer_time_minutes": 2,
            "notes": "First operation",
        }

        response = self.client.post("/api/jobs/operations/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Operation.objects.count(), 1)

    def test_list_operations(self):
        Operation.objects.create(
            job=self.job,
            machine=self.machine,
            sequence_order=1,
            processing_time_minutes=15,
            setup_time_minutes=3,
            transfer_time_minutes=1,
        )

        response = self.client.get("/api/jobs/operations/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
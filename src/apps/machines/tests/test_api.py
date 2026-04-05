from django.test import TestCase
from rest_framework.test import APIClient

from apps.machines.models import Machine


class MachineAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_list_machines(self):
        Machine.objects.create(
            code="M1",
            name="Machine 1",
            workstation_number=1,
        )

        response = self.client.get("/api/machines/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_create_machine(self):
        payload = {
            "code": "M2",
            "name": "Machine 2",
            "machine_type": "other",
            "description": "",
            "workstation_number": 2,
            "capacity_per_day": 480,
            "is_active": True,
        }

        response = self.client.post("/api/machines/", payload, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Machine.objects.count(), 1)
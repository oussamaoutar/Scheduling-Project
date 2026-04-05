from rest_framework.test import APITestCase


class HealthCheckAPITestCase(APITestCase):
    def test_healthcheck_returns_success(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")
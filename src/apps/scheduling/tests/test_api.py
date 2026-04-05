from django.test import TestCase
from rest_framework.test import APIClient

from apps.jobs.models import Job, Operation
from apps.machines.models import Machine
from apps.scheduling.models import ScheduleRun


class ScheduleRunAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.machine_1 = Machine.objects.create(
            code="M1",
            name="Machine 1",
            workstation_number=1,
        )
        self.machine_2 = Machine.objects.create(
            code="M2",
            name="Machine 2",
            workstation_number=2,
        )

        self.job_1 = Job.objects.create(
            code="J1",
            name="Job 1",
            quantity=5,
        )
        self.job_2 = Job.objects.create(
            code="J2",
            name="Job 2",
            quantity=3,
        )

        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=12,
            setup_time_minutes=2,
            transfer_time_minutes=1,
        )
        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=8,
            setup_time_minutes=1,
            transfer_time_minutes=1,
        )

        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=6,
            setup_time_minutes=1,
            transfer_time_minutes=1,
        )
        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=5,
            setup_time_minutes=1,
            transfer_time_minutes=1,
        )

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
            "job_ids": [self.job_1.id, self.job_2.id],
        }

        response = self.client.post(
            "/api/scheduling/runs/",
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ScheduleRun.objects.count(), 1)

    def test_execute_schedule_run_with_spt(self):
        schedule_run = ScheduleRun.objects.create(
            name="Executable Run",
            algorithm=ScheduleRun.Algorithm.SPT,
        )
        schedule_run.jobs.set([self.job_1, self.job_2])

        response = self.client.post(
            f"/api/scheduling/runs/{schedule_run.id}/execute/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        schedule_run.refresh_from_db()
        self.assertEqual(schedule_run.status, ScheduleRun.RunStatus.COMPLETED)
        self.assertGreater(len(schedule_run.job_sequence), 0)
        self.assertGreater(len(schedule_run.gantt_data), 0)
        self.assertIsNotNone(schedule_run.cmax_minutes)

    def test_execute_schedule_run_with_johnson(self):
        schedule_run = ScheduleRun.objects.create(
            name="Johnson Run API",
            algorithm=ScheduleRun.Algorithm.JOHNSON,
        )
        schedule_run.jobs.set([self.job_1, self.job_2])

        response = self.client.post(
            f"/api/scheduling/runs/{schedule_run.id}/execute/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["result_metrics"]["ordering_metadata"]["method"],
            "johnson",
        )
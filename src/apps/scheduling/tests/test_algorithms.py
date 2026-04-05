from datetime import date, timedelta

from django.test import TestCase

from apps.jobs.models import Job, Operation
from apps.machines.models import Machine
from apps.scheduling.algorithms.cds import cds_order
from apps.scheduling.algorithms.johnson import johnson_order
from apps.scheduling.algorithms.rules import (
    sort_jobs_by_edd,
    sort_jobs_by_lpt,
    sort_jobs_by_spt,
)
from apps.scheduling.models import ScheduleRun
from apps.scheduling.services.schedule_service import ScheduleService


class SchedulingRulesTestCase(TestCase):
    def setUp(self):
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
            due_date=date.today() + timedelta(days=3),
            priority=2,
        )
        self.job_2 = Job.objects.create(
            code="J2",
            name="Job 2",
            due_date=date.today() + timedelta(days=1),
            priority=1,
        )
        self.job_3 = Job.objects.create(
            code="J3",
            name="Job 3",
            due_date=date.today() + timedelta(days=2),
            priority=3,
        )

        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=10,
            setup_time_minutes=2,
            transfer_time_minutes=1,
        )
        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=8,
            setup_time_minutes=2,
            transfer_time_minutes=1,
        )

        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=5,
            setup_time_minutes=1,
            transfer_time_minutes=1,
        )
        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=6,
            setup_time_minutes=1,
            transfer_time_minutes=1,
        )

        Operation.objects.create(
            job=self.job_3,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=12,
            setup_time_minutes=2,
            transfer_time_minutes=1,
        )
        Operation.objects.create(
            job=self.job_3,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=7,
            setup_time_minutes=2,
            transfer_time_minutes=1,
        )

    def test_sort_jobs_by_spt(self):
        ordered_jobs = sort_jobs_by_spt([self.job_1, self.job_2, self.job_3])
        self.assertEqual([job.code for job in ordered_jobs], ["J2", "J1", "J3"])

    def test_sort_jobs_by_lpt(self):
        ordered_jobs = sort_jobs_by_lpt([self.job_1, self.job_2, self.job_3])
        self.assertEqual([job.code for job in ordered_jobs], ["J3", "J1", "J2"])

    def test_sort_jobs_by_edd(self):
        ordered_jobs = sort_jobs_by_edd([self.job_1, self.job_2, self.job_3])
        self.assertEqual([job.code for job in ordered_jobs], ["J2", "J3", "J1"])


class JohnsonAlgorithmTestCase(TestCase):
    def test_johnson_order_returns_expected_sequence(self):
        job_profiles = [
            {
                "job_id": 1,
                "job_code": "J1",
                "times": [2, 7],
            },
            {
                "job_id": 2,
                "job_code": "J2",
                "times": [3, 1],
            },
            {
                "job_id": 3,
                "job_code": "J3",
                "times": [4, 6],
            },
        ]

        ordered_profiles = johnson_order(job_profiles)

        self.assertEqual(
            [profile["job_code"] for profile in ordered_profiles],
            ["J1", "J3", "J2"],
        )


class CDSAlgorithmTestCase(TestCase):
    def test_cds_order_returns_complete_sequence(self):
        job_profiles = [
            {
                "job": None,
                "job_id": 1,
                "job_code": "J1",
                "times": [4, 8, 3],
            },
            {
                "job": None,
                "job_id": 2,
                "job_code": "J2",
                "times": [3, 5, 7],
            },
            {
                "job": None,
                "job_id": 3,
                "job_code": "J3",
                "times": [5, 2, 4],
            },
            {
                "job": None,
                "job_id": 4,
                "job_code": "J4",
                "times": [2, 4, 7],
            },
        ]

        ordered_profiles, metadata = cds_order(job_profiles)

        self.assertEqual(len(ordered_profiles), 4)
        self.assertCountEqual(
            [profile["job_code"] for profile in ordered_profiles],
            ["J1", "J2", "J3", "J4"],
        )
        self.assertIn("selected_k", metadata)
        self.assertIn("estimated_cmax", metadata)


class ScheduleServiceSPTTestCase(TestCase):
    def setUp(self):
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
            due_date=date.today() + timedelta(days=2),
        )
        self.job_2 = Job.objects.create(
            code="J2",
            name="Job 2",
            due_date=date.today() + timedelta(days=1),
        )

        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=10,
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
            processing_time_minutes=5,
            setup_time_minutes=1,
            transfer_time_minutes=1,
        )
        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=6,
            setup_time_minutes=1,
            transfer_time_minutes=1,
        )

    def test_execute_run_with_spt(self):
        schedule_run = ScheduleRun.objects.create(
            name="SPT Run",
            algorithm=ScheduleRun.Algorithm.SPT,
        )
        schedule_run.jobs.set([self.job_1, self.job_2])

        service = ScheduleService()
        updated_run = service.execute_run(schedule_run)

        self.assertEqual(updated_run.status, ScheduleRun.RunStatus.COMPLETED)
        self.assertEqual(len(updated_run.job_sequence), 2)
        self.assertGreater(len(updated_run.gantt_data), 0)
        self.assertIsNotNone(updated_run.cmax_minutes)
        self.assertIsNotNone(updated_run.total_flow_time_minutes)


class ScheduleServiceJohnsonTestCase(TestCase):
    def setUp(self):
        self.machine_1 = Machine.objects.create(
            code="JM1",
            name="Johnson Machine 1",
            workstation_number=11,
        )
        self.machine_2 = Machine.objects.create(
            code="JM2",
            name="Johnson Machine 2",
            workstation_number=12,
        )

        self.job_1 = Job.objects.create(
            code="JJ1",
            name="Johnson Job 1",
        )
        self.job_2 = Job.objects.create(
            code="JJ2",
            name="Johnson Job 2",
        )

        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=10,
            setup_time_minutes=2,
            transfer_time_minutes=0,
        )
        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=8,
            setup_time_minutes=1,
            transfer_time_minutes=0,
        )

        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=5,
            setup_time_minutes=1,
            transfer_time_minutes=0,
        )
        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=6,
            setup_time_minutes=1,
            transfer_time_minutes=0,
        )

    def test_execute_run_with_johnson(self):
        schedule_run = ScheduleRun.objects.create(
            name="Johnson Run",
            algorithm=ScheduleRun.Algorithm.JOHNSON,
        )
        schedule_run.jobs.set([self.job_1, self.job_2])

        service = ScheduleService()
        updated_run = service.execute_run(schedule_run)

        self.assertEqual(updated_run.status, ScheduleRun.RunStatus.COMPLETED)
        self.assertEqual(
            [item["job_code"] for item in updated_run.job_sequence],
            ["JJ2", "JJ1"],
        )
        self.assertEqual(
            updated_run.result_metrics["ordering_metadata"]["method"],
            "johnson",
        )


class ScheduleServiceCDSTestCase(TestCase):
    def setUp(self):
        self.machine_1 = Machine.objects.create(
            code="CM1",
            name="CDS Machine 1",
            workstation_number=21,
        )
        self.machine_2 = Machine.objects.create(
            code="CM2",
            name="CDS Machine 2",
            workstation_number=22,
        )
        self.machine_3 = Machine.objects.create(
            code="CM3",
            name="CDS Machine 3",
            workstation_number=23,
        )

        self.job_1 = Job.objects.create(code="CJ1", name="CDS Job 1")
        self.job_2 = Job.objects.create(code="CJ2", name="CDS Job 2")
        self.job_3 = Job.objects.create(code="CJ3", name="CDS Job 3")

        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=4,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )
        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=8,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )
        Operation.objects.create(
            job=self.job_1,
            machine=self.machine_3,
            sequence_order=3,
            processing_time_minutes=3,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )

        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=3,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )
        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=5,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )
        Operation.objects.create(
            job=self.job_2,
            machine=self.machine_3,
            sequence_order=3,
            processing_time_minutes=7,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )

        Operation.objects.create(
            job=self.job_3,
            machine=self.machine_1,
            sequence_order=1,
            processing_time_minutes=5,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )
        Operation.objects.create(
            job=self.job_3,
            machine=self.machine_2,
            sequence_order=2,
            processing_time_minutes=2,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )
        Operation.objects.create(
            job=self.job_3,
            machine=self.machine_3,
            sequence_order=3,
            processing_time_minutes=4,
            setup_time_minutes=0,
            transfer_time_minutes=0,
        )

    def test_execute_run_with_cds(self):
        schedule_run = ScheduleRun.objects.create(
            name="CDS Run",
            algorithm=ScheduleRun.Algorithm.CDS,
        )
        schedule_run.jobs.set([self.job_1, self.job_2, self.job_3])

        service = ScheduleService()
        updated_run = service.execute_run(schedule_run)

        self.assertEqual(updated_run.status, ScheduleRun.RunStatus.COMPLETED)
        self.assertEqual(len(updated_run.job_sequence), 3)
        self.assertGreater(len(updated_run.gantt_data), 0)
        self.assertEqual(
            updated_run.result_metrics["ordering_metadata"]["method"],
            "cds",
        )
        self.assertIn(
            "selected_k",
            updated_run.result_metrics["ordering_metadata"],
        )
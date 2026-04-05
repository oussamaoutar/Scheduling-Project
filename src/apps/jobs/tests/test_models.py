from django.test import TestCase

from apps.jobs.models import Job, Operation
from apps.machines.models import Machine


class JobModelTestCase(TestCase):
    def test_job_total_processing_time(self):
        machine_1 = Machine.objects.create(
            code="M1",
            name="Machine 1",
            workstation_number=1,
        )
        machine_2 = Machine.objects.create(
            code="M2",
            name="Machine 2",
            workstation_number=2,
        )

        job = Job.objects.create(
            code="J1",
            name="Job 1",
            quantity=10,
        )

        Operation.objects.create(
            job=job,
            machine=machine_1,
            sequence_order=1,
            processing_time_minutes=20,
            setup_time_minutes=5,
            transfer_time_minutes=2,
        )
        Operation.objects.create(
            job=job,
            machine=machine_2,
            sequence_order=2,
            processing_time_minutes=15,
            setup_time_minutes=3,
            transfer_time_minutes=1,
        )

        self.assertEqual(job.total_processing_time, 43)


class OperationModelTestCase(TestCase):
    def test_operation_total_time(self):
        machine = Machine.objects.create(
            code="M1",
            name="Machine 1",
            workstation_number=1,
        )
        job = Job.objects.create(
            code="J1",
            name="Job 1",
        )

        operation = Operation.objects.create(
            job=job,
            machine=machine,
            sequence_order=1,
            processing_time_minutes=30,
            setup_time_minutes=10,
            transfer_time_minutes=5,
        )

        self.assertEqual(operation.total_time_minutes, 45)
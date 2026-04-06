from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.jobs.models import Job, Operation
from apps.machines.models import Machine


class Command(BaseCommand):
    help = "Seed demo data for the industrial scheduling backend."

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data...")

        machine_specs = [
            {
                "code": "M1",
                "name": "Machine 1",
                "machine_type": Machine.MachineType.CUTTING,
                "description": "Primary cutting machine",
                "workstation_number": 1,
                "capacity_per_day": 480,
                "is_active": True,
            },
            {
                "code": "M2",
                "name": "Machine 2",
                "machine_type": Machine.MachineType.MILLING,
                "description": "Secondary milling machine",
                "workstation_number": 2,
                "capacity_per_day": 480,
                "is_active": True,
            },
            {
                "code": "M3",
                "name": "Machine 3",
                "machine_type": Machine.MachineType.ASSEMBLY,
                "description": "Final assembly machine",
                "workstation_number": 3,
                "capacity_per_day": 480,
                "is_active": True,
            },
        ]

        machine_map = {}

        for spec in machine_specs:
            machine, _ = Machine.objects.update_or_create(
                code=spec["code"],
                defaults={
                    "name": spec["name"],
                    "machine_type": spec["machine_type"],
                    "description": spec["description"],
                    "workstation_number": spec["workstation_number"],
                    "capacity_per_day": spec["capacity_per_day"],
                    "is_active": spec["is_active"],
                },
            )
            machine_map[spec["code"]] = machine

        base_date = date.today()

        job_specs = [
            {
                "code": "J1",
                "name": "Pump Housing",
                "quantity": 10,
                "priority": 2,
                "release_offset_days": 0,
                "due_offset_days": 3,
                "times": {"M1": 4, "M2": 8, "M3": 3},
            },
            {
                "code": "J2",
                "name": "Valve Body",
                "quantity": 8,
                "priority": 1,
                "release_offset_days": 0,
                "due_offset_days": 2,
                "times": {"M1": 3, "M2": 5, "M3": 7},
            },
            {
                "code": "J3",
                "name": "Rotor Shaft",
                "quantity": 12,
                "priority": 3,
                "release_offset_days": 0,
                "due_offset_days": 4,
                "times": {"M1": 5, "M2": 2, "M3": 4},
            },
            {
                "code": "J4",
                "name": "Bearing Support",
                "quantity": 6,
                "priority": 2,
                "release_offset_days": 1,
                "due_offset_days": 5,
                "times": {"M1": 2, "M2": 4, "M3": 7},
            },
            {
                "code": "J5",
                "name": "Drive Cover",
                "quantity": 9,
                "priority": 4,
                "release_offset_days": 1,
                "due_offset_days": 6,
                "times": {"M1": 7, "M2": 3, "M3": 5},
            },
            {
                "code": "J6",
                "name": "Gear Plate",
                "quantity": 7,
                "priority": 3,
                "release_offset_days": 2,
                "due_offset_days": 7,
                "times": {"M1": 3, "M2": 7, "M3": 6},
            },
        ]

        for spec in job_specs:
            job, _ = Job.objects.update_or_create(
                code=spec["code"],
                defaults={
                    "name": spec["name"],
                    "description": "Demo seeded job",
                    "quantity": spec["quantity"],
                    "release_date": base_date + timedelta(days=spec["release_offset_days"]),
                    "due_date": base_date + timedelta(days=spec["due_offset_days"]),
                    "priority": spec["priority"],
                    "status": Job.JobStatus.READY,
                    "is_active": True,
                },
            )

            ordered_machine_codes = ["M1", "M2", "M3"]

            for sequence_order, machine_code in enumerate(ordered_machine_codes, start=1):
                Operation.objects.update_or_create(
                    job=job,
                    sequence_order=sequence_order,
                    defaults={
                        "machine": machine_map[machine_code],
                        "processing_time_minutes": spec["times"][machine_code],
                        "setup_time_minutes": 0,
                        "transfer_time_minutes": 0,
                        "notes": f"{job.code} on {machine_code}",
                    },
                )

            job.operations.exclude(sequence_order__in=[1, 2, 3]).delete()

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
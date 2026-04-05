from datetime import date

from django.db import transaction
from django.utils import timezone

from apps.jobs.models import Job
from apps.metrics.services.metrics_service import build_result_metrics
from apps.scheduling.algorithms.cds import cds_order
from apps.scheduling.algorithms.johnson import johnson_order
from apps.scheduling.algorithms.rules import (
    sort_jobs_by_edd,
    sort_jobs_by_lpt,
    sort_jobs_by_spt,
)
from apps.scheduling.models import ScheduleRun


WORKDAY_MINUTES = 480


class ScheduleService:
    def execute_run(self, schedule_run):
        try:
            with transaction.atomic():
                schedule_run.status = ScheduleRun.RunStatus.RUNNING
                schedule_run.launched_at = timezone.now()
                schedule_run.finished_at = None
                schedule_run.error_message = ""
                schedule_run.job_sequence = []
                schedule_run.gantt_data = []
                schedule_run.result_metrics = {}
                schedule_run.cmax_minutes = None
                schedule_run.total_flow_time_minutes = None
                schedule_run.average_tardiness_minutes = None
                schedule_run.save()

                jobs = self._get_jobs_for_run(schedule_run)
                ordered_jobs, ordering_metadata = self._order_jobs(
                    jobs=jobs,
                    algorithm=schedule_run.algorithm,
                )

                planning_anchor_date = self._get_planning_anchor_date(
                    ordered_jobs
                )
                job_sequence_data = self._build_job_sequence_data(ordered_jobs)
                gantt_data, job_completion_times = self._build_gantt_data(
                    ordered_jobs=ordered_jobs,
                    planning_anchor_date=planning_anchor_date,
                )
                result_metrics = build_result_metrics(
                    job_sequence=ordered_jobs,
                    gantt_data=gantt_data,
                    job_completion_times=job_completion_times,
                    planning_anchor_date=planning_anchor_date,
                )

                if ordering_metadata:
                    result_metrics["ordering_metadata"] = ordering_metadata

                schedule_run.job_sequence = job_sequence_data
                schedule_run.gantt_data = gantt_data
                schedule_run.result_metrics = result_metrics
                schedule_run.cmax_minutes = result_metrics["cmax_minutes"]
                schedule_run.total_flow_time_minutes = result_metrics[
                    "total_flow_time_minutes"
                ]
                schedule_run.average_tardiness_minutes = result_metrics[
                    "average_tardiness_minutes"
                ]
                schedule_run.status = ScheduleRun.RunStatus.COMPLETED
                schedule_run.finished_at = timezone.now()
                schedule_run.save()

                return schedule_run

        except Exception as exc:
            schedule_run.status = ScheduleRun.RunStatus.FAILED
            schedule_run.finished_at = timezone.now()
            schedule_run.error_message = str(exc)
            schedule_run.save(
                update_fields=[
                    "status",
                    "finished_at",
                    "error_message",
                    "updated_at",
                ]
            )
            raise

    def _get_jobs_for_run(self, schedule_run):
        selected_jobs_queryset = schedule_run.jobs.prefetch_related(
            "operations__machine"
        )

        if selected_jobs_queryset.exists():
            jobs = list(selected_jobs_queryset)
        else:
            jobs = list(
                Job.objects.filter(is_active=True)
                .exclude(
                    status__in=[
                        Job.JobStatus.COMPLETED,
                        Job.JobStatus.CANCELLED,
                    ]
                )
                .prefetch_related("operations__machine")
            )

        if not jobs:
            raise ValueError("No jobs available for scheduling.")

        for job in jobs:
            if not job.operations.exists():
                raise ValueError(f"Job {job.code} has no operations defined.")

        return jobs

    def _get_ordered_operations(self, job):
        return sorted(
            list(job.operations.all()),
            key=lambda operation: operation.sequence_order,
        )

    def _build_flow_shop_job_profiles(self, jobs):
        profiles = []
        reference_machine_sequence = None
        reference_machine_codes = None

        for job in jobs:
            operations = self._get_ordered_operations(job)
            machine_sequence = [operation.machine_id for operation in operations]
            machine_codes = [operation.machine.code for operation in operations]

            if reference_machine_sequence is None:
                reference_machine_sequence = machine_sequence
                reference_machine_codes = machine_codes
            elif machine_sequence != reference_machine_sequence:
                raise ValueError(
                    "Johnson and CDS require a flow shop: all jobs must follow the same machine order."
                )

            profiles.append(
                {
                    "job": job,
                    "job_id": job.id,
                    "job_code": job.code,
                    "times": [
                        operation.processing_time_minutes
                        + operation.setup_time_minutes
                        for operation in operations
                    ],
                }
            )

        return profiles, reference_machine_codes

    def _order_jobs(self, jobs, algorithm):
        if algorithm == ScheduleRun.Algorithm.SPT:
            return sort_jobs_by_spt(jobs), {
                "method": "spt",
            }

        if algorithm == ScheduleRun.Algorithm.LPT:
            return sort_jobs_by_lpt(jobs), {
                "method": "lpt",
            }

        if algorithm == ScheduleRun.Algorithm.EDD:
            return sort_jobs_by_edd(jobs), {
                "method": "edd",
            }

        if algorithm == ScheduleRun.Algorithm.JOHNSON:
            job_profiles, machine_codes = self._build_flow_shop_job_profiles(
                jobs
            )

            if len(job_profiles[0]["times"]) != 2:
                raise ValueError(
                    "Johnson requires exactly 2 machines per job."
                )

            ordered_profiles = johnson_order(job_profiles)
            ordered_jobs = [profile["job"] for profile in ordered_profiles]

            return ordered_jobs, {
                "method": "johnson",
                "machine_count": 2,
                "machine_sequence": machine_codes,
            }

        if algorithm == ScheduleRun.Algorithm.CDS:
            job_profiles, machine_codes = self._build_flow_shop_job_profiles(
                jobs
            )

            machine_count = len(job_profiles[0]["times"])

            if machine_count < 3:
                raise ValueError(
                    "CDS requires at least 3 machines per job."
                )

            ordered_profiles, cds_metadata = cds_order(job_profiles)
            ordered_jobs = [profile["job"] for profile in ordered_profiles]

            return ordered_jobs, {
                "method": "cds",
                "machine_count": machine_count,
                "machine_sequence": machine_codes,
                "selected_k": cds_metadata["selected_k"],
                "estimated_cmax": cds_metadata["estimated_cmax"],
            }

        raise ValueError(f"Algorithm '{algorithm}' is not supported.")

    def _get_planning_anchor_date(self, jobs):
        candidate_dates = [
            job.release_date for job in jobs if job.release_date is not None
        ]
        if candidate_dates:
            return min(candidate_dates)
        return date.today()

    def _release_offset_minutes(self, job, planning_anchor_date):
        if job.release_date is None:
            return 0

        delta_days = (job.release_date - planning_anchor_date).days
        if delta_days <= 0:
            return 0

        return delta_days * WORKDAY_MINUTES

    def _build_job_sequence_data(self, ordered_jobs):
        sequence_data = []

        for index, job in enumerate(ordered_jobs, start=1):
            sequence_data.append(
                {
                    "position": index,
                    "job_id": job.id,
                    "job_code": job.code,
                    "job_name": job.name,
                    "priority": job.priority,
                    "due_date": (
                        job.due_date.isoformat() if job.due_date else None
                    ),
                    "total_processing_time": job.total_processing_time,
                }
            )

        return sequence_data

    def _build_gantt_data(self, ordered_jobs, planning_anchor_date):
        machine_availability = {}
        job_completion_times = {}
        gantt_data = []

        for sequence_position, job in enumerate(ordered_jobs, start=1):
            previous_operation_end = self._release_offset_minutes(
                job=job,
                planning_anchor_date=planning_anchor_date,
            )

            operations = self._get_ordered_operations(job)

            for operation in operations:
                machine_ready_at = machine_availability.get(
                    operation.machine_id, 0
                )

                start_time = max(
                    previous_operation_end + operation.transfer_time_minutes,
                    machine_ready_at,
                )
                setup_end = start_time + operation.setup_time_minutes
                end_time = setup_end + operation.processing_time_minutes

                gantt_data.append(
                    {
                        "job_id": job.id,
                        "job_code": job.code,
                        "job_name": job.name,
                        "machine_id": operation.machine.id,
                        "machine_code": operation.machine.code,
                        "machine_name": operation.machine.name,
                        "operation_id": operation.id,
                        "operation_order": operation.sequence_order,
                        "sequence_position": sequence_position,
                        "start_time": start_time,
                        "setup_time": operation.setup_time_minutes,
                        "processing_time": operation.processing_time_minutes,
                        "transfer_time": operation.transfer_time_minutes,
                        "end_time": end_time,
                    }
                )

                machine_availability[operation.machine_id] = end_time
                previous_operation_end = end_time

            job_completion_times[job.id] = previous_operation_end

        return gantt_data, job_completion_times
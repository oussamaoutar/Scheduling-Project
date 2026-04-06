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
                execution_result = self._run_algorithm_for_jobs(
                    jobs=jobs,
                    algorithm=schedule_run.algorithm,
                )

                schedule_run.job_sequence = execution_result["job_sequence"]
                schedule_run.gantt_data = execution_result["gantt_data"]
                schedule_run.result_metrics = execution_result["result_metrics"]
                schedule_run.cmax_minutes = execution_result["result_metrics"]["cmax_minutes"]
                schedule_run.total_flow_time_minutes = execution_result["result_metrics"]["total_flow_time_minutes"]
                schedule_run.average_tardiness_minutes = execution_result["result_metrics"]["average_tardiness_minutes"]
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

    def compare_algorithms(
        self,
        selected_jobs=None,
        algorithms=None,
        ranking_metric="cmax_minutes",
    ):
        jobs = self._get_jobs_for_comparison(selected_jobs)
        algorithms = self._normalize_algorithms(algorithms)

        comparison_results = []

        for algorithm in algorithms:
            try:
                execution_result = self._run_algorithm_for_jobs(
                    jobs=jobs,
                    algorithm=algorithm,
                )

                comparison_results.append(
                    {
                        "algorithm": algorithm,
                        "algorithm_label": self._get_algorithm_label(algorithm),
                        "status": "success",
                        "job_sequence": execution_result["job_sequence"],
                        "gantt_data": execution_result["gantt_data"],
                        "result_metrics": execution_result["result_metrics"],
                    }
                )
            except Exception as exc:
                comparison_results.append(
                    {
                        "algorithm": algorithm,
                        "algorithm_label": self._get_algorithm_label(algorithm),
                        "status": "failed",
                        "error_message": str(exc),
                    }
                )

        successful_results = [
            item for item in comparison_results if item["status"] == "success"
        ]
        failed_results = [
            item for item in comparison_results if item["status"] == "failed"
        ]

        successful_results.sort(
            key=lambda item: (
                item["result_metrics"].get(ranking_metric, float("inf")),
                item["algorithm"],
            )
        )

        for index, item in enumerate(successful_results, start=1):
            item["rank"] = index

        return {
            "ranking_metric": ranking_metric,
            "job_count": len(jobs),
            "algorithms_requested": algorithms,
            "successful_algorithms": len(successful_results),
            "failed_algorithms": len(failed_results),
            "results": successful_results + failed_results,
        }

    def get_algorithm_catalog(self):
        return [
            {
                "code": ScheduleRun.Algorithm.SPT,
                "label": "SPT",
                "category": "priority_rule",
                "implemented": True,
                "constraints": {
                    "flow_shop_required": False,
                    "exact_machine_count": None,
                    "minimum_machine_count": 1,
                },
            },
            {
                "code": ScheduleRun.Algorithm.LPT,
                "label": "LPT",
                "category": "priority_rule",
                "implemented": True,
                "constraints": {
                    "flow_shop_required": False,
                    "exact_machine_count": None,
                    "minimum_machine_count": 1,
                },
            },
            {
                "code": ScheduleRun.Algorithm.EDD,
                "label": "EDD",
                "category": "priority_rule",
                "implemented": True,
                "constraints": {
                    "flow_shop_required": False,
                    "exact_machine_count": None,
                    "minimum_machine_count": 1,
                },
            },
            {
                "code": ScheduleRun.Algorithm.JOHNSON,
                "label": "Johnson",
                "category": "exact_algorithm",
                "implemented": True,
                "constraints": {
                    "flow_shop_required": True,
                    "exact_machine_count": 2,
                    "minimum_machine_count": 2,
                },
            },
            {
                "code": ScheduleRun.Algorithm.CDS,
                "label": "CDS",
                "category": "heuristic",
                "implemented": True,
                "constraints": {
                    "flow_shop_required": True,
                    "exact_machine_count": None,
                    "minimum_machine_count": 3,
                },
            },
        ]

    def _normalize_algorithms(self, algorithms):
        if not algorithms:
            algorithms = [
                ScheduleRun.Algorithm.SPT,
                ScheduleRun.Algorithm.LPT,
                ScheduleRun.Algorithm.EDD,
                ScheduleRun.Algorithm.JOHNSON,
                ScheduleRun.Algorithm.CDS,
            ]

        normalized = []
        seen = set()

        for algorithm in algorithms:
            if algorithm not in seen:
                seen.add(algorithm)
                normalized.append(algorithm)

        return normalized

    def _get_algorithm_label(self, algorithm_code):
        return dict(ScheduleRun.Algorithm.choices).get(
            algorithm_code,
            algorithm_code,
        )

    def _run_algorithm_for_jobs(self, jobs, algorithm):
        ordered_jobs, ordering_metadata = self._order_jobs(
            jobs=jobs,
            algorithm=algorithm,
        )

        planning_anchor_date = self._get_planning_anchor_date(ordered_jobs)
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

        return {
            "ordered_jobs": ordered_jobs,
            "job_sequence": job_sequence_data,
            "gantt_data": gantt_data,
            "job_completion_times": job_completion_times,
            "result_metrics": result_metrics,
        }

    def _build_base_queryset(self):
        return (
            Job.objects.filter(is_active=True)
            .exclude(
                status__in=[
                    Job.JobStatus.COMPLETED,
                    Job.JobStatus.CANCELLED,
                ]
            )
            .prefetch_related("operations__machine")
        )

    def _prepare_jobs_from_queryset(self, queryset):
        jobs = list(queryset)

        if not jobs:
            raise ValueError("No jobs available for scheduling.")

        for job in jobs:
            if not job.operations.exists():
                raise ValueError(f"Job {job.code} has no operations defined.")

        return jobs

    def _get_jobs_for_run(self, schedule_run):
        selected_jobs_queryset = schedule_run.jobs.prefetch_related("operations__machine")

        if selected_jobs_queryset.exists():
            return self._prepare_jobs_from_queryset(selected_jobs_queryset)

        return self._prepare_jobs_from_queryset(self._build_base_queryset())

    def _get_jobs_for_comparison(self, selected_jobs=None):
        if selected_jobs:
            selected_ids = [job.id for job in selected_jobs]
            queryset = (
                Job.objects.filter(id__in=selected_ids)
                .prefetch_related("operations__machine")
            )
            jobs = self._prepare_jobs_from_queryset(queryset)
            order_map = {job.id: index for index, job in enumerate(selected_jobs)}
            jobs.sort(key=lambda job: order_map[job.id])
            return jobs

        return self._prepare_jobs_from_queryset(self._build_base_queryset())

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
            job_profiles, machine_codes = self._build_flow_shop_job_profiles(jobs)

            if len(job_profiles[0]["times"]) != 2:
                raise ValueError("Johnson requires exactly 2 machines per job.")

            ordered_profiles = johnson_order(job_profiles)
            ordered_jobs = [profile["job"] for profile in ordered_profiles]

            return ordered_jobs, {
                "method": "johnson",
                "machine_count": 2,
                "machine_sequence": machine_codes,
            }

        if algorithm == ScheduleRun.Algorithm.CDS:
            job_profiles, machine_codes = self._build_flow_shop_job_profiles(jobs)
            machine_count = len(job_profiles[0]["times"])

            if machine_count < 3:
                raise ValueError("CDS requires at least 3 machines per job.")

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
                    "due_date": job.due_date.isoformat() if job.due_date else None,
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
                machine_ready_at = machine_availability.get(operation.machine_id, 0)

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
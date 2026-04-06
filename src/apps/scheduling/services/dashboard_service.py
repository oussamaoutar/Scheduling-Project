from apps.jobs.models import Job, Operation
from apps.machines.models import Machine
from apps.scheduling.models import ScheduleRun


class SchedulingDashboardService:
    def build_dashboard_summary(self):
        recent_runs = ScheduleRun.objects.order_by("-created_at")[:5]

        return {
            "counters": {
                "machines": Machine.objects.count(),
                "active_machines": Machine.objects.filter(is_active=True).count(),
                "jobs": Job.objects.count(),
                "active_jobs": Job.objects.filter(is_active=True).count(),
                "operations": Operation.objects.count(),
                "schedule_runs": ScheduleRun.objects.count(),
                "completed_runs": ScheduleRun.objects.filter(
                    status=ScheduleRun.RunStatus.COMPLETED
                ).count(),
            },
            "recent_runs": [
                {
                    "id": run.id,
                    "name": run.name,
                    "algorithm": run.algorithm,
                    "objective": run.objective,
                    "status": run.status,
                    "cmax_minutes": run.cmax_minutes,
                    "total_flow_time_minutes": run.total_flow_time_minutes,
                    "average_tardiness_minutes": run.average_tardiness_minutes,
                    "created_at": run.created_at,
                    "finished_at": run.finished_at,
                }
                for run in recent_runs
            ],
        }

    def build_run_summary(self, schedule_run):
        metrics = schedule_run.result_metrics or {}

        return {
            "run": {
                "id": schedule_run.id,
                "name": schedule_run.name,
                "algorithm": schedule_run.algorithm,
                "objective": schedule_run.objective,
                "status": schedule_run.status,
                "launched_at": schedule_run.launched_at,
                "finished_at": schedule_run.finished_at,
                "notes": schedule_run.notes,
                "error_message": schedule_run.error_message,
            },
            "kpis": {
                "cmax_minutes": schedule_run.cmax_minutes,
                "total_flow_time_minutes": schedule_run.total_flow_time_minutes,
                "average_tardiness_minutes": schedule_run.average_tardiness_minutes,
                "total_jobs": metrics.get("total_jobs", 0),
                "scheduled_operations": metrics.get("scheduled_operations", 0),
                "average_flow_time_minutes": metrics.get("average_flow_time_minutes", 0),
                "total_tardiness_minutes": metrics.get("total_tardiness_minutes", 0),
                "max_tardiness_minutes": metrics.get("max_tardiness_minutes", 0),
                "late_jobs_count": metrics.get("late_jobs_count", 0),
                "on_time_jobs_count": metrics.get("on_time_jobs_count", 0),
            },
            "sequence": schedule_run.job_sequence or [],
            "machine_statistics": metrics.get("machine_statistics", []),
            "job_completion_details": metrics.get("job_completion_details", []),
            "ordering_metadata": metrics.get("ordering_metadata", {}),
        }

    def build_run_kpis(self, schedule_run):
        metrics = schedule_run.result_metrics or {}

        return {
            "run_id": schedule_run.id,
            "run_name": schedule_run.name,
            "algorithm": schedule_run.algorithm,
            "status": schedule_run.status,
            "kpis": {
                "cmax_minutes": schedule_run.cmax_minutes,
                "total_flow_time_minutes": schedule_run.total_flow_time_minutes,
                "average_tardiness_minutes": schedule_run.average_tardiness_minutes,
                "average_flow_time_minutes": metrics.get("average_flow_time_minutes", 0),
                "total_tardiness_minutes": metrics.get("total_tardiness_minutes", 0),
                "max_tardiness_minutes": metrics.get("max_tardiness_minutes", 0),
                "late_jobs_count": metrics.get("late_jobs_count", 0),
                "on_time_jobs_count": metrics.get("on_time_jobs_count", 0),
            },
            "ordering_metadata": metrics.get("ordering_metadata", {}),
            "machine_statistics": metrics.get("machine_statistics", []),
        }

    def build_run_gantt(self, schedule_run):
        gantt_data = schedule_run.gantt_data or []

        machine_map = {}
        job_map = {}
        max_end_time = 0

        for item in gantt_data:
            machine_id = item["machine_id"]
            job_id = item["job_id"]

            if machine_id not in machine_map:
                machine_map[machine_id] = {
                    "machine_id": machine_id,
                    "machine_code": item["machine_code"],
                    "machine_name": item["machine_name"],
                    "tasks": [],
                }

            if job_id not in job_map:
                job_map[job_id] = {
                    "job_id": job_id,
                    "job_code": item["job_code"],
                    "job_name": item["job_name"],
                    "sequence_position": item["sequence_position"],
                    "tasks": [],
                }

            task = {
                "operation_id": item["operation_id"],
                "operation_order": item["operation_order"],
                "start_time": item["start_time"],
                "end_time": item["end_time"],
                "setup_time": item["setup_time"],
                "processing_time": item["processing_time"],
                "transfer_time": item["transfer_time"],
                "duration": item["end_time"] - item["start_time"],
                "label": f'{item["job_code"]} - Op{item["operation_order"]}',
            }

            machine_map[machine_id]["tasks"].append(task)

            job_map[job_id]["tasks"].append(
                {
                    "machine_id": machine_id,
                    "machine_code": item["machine_code"],
                    "machine_name": item["machine_name"],
                    **task,
                }
            )

            max_end_time = max(max_end_time, item["end_time"])

        machine_rows = sorted(
            machine_map.values(),
            key=lambda machine: machine["machine_code"],
        )
        job_rows = sorted(
            job_map.values(),
            key=lambda job: job["sequence_position"],
        )

        return {
            "run_id": schedule_run.id,
            "run_name": schedule_run.name,
            "algorithm": schedule_run.algorithm,
            "timeline": {
                "start_time": 0,
                "end_time": max_end_time,
                "total_duration": max_end_time,
            },
            "machines": machine_rows,
            "jobs": job_rows,
            "raw_items": gantt_data,
        }
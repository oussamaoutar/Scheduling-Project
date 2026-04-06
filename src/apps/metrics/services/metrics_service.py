WORKDAY_MINUTES = 480


def compute_cmax(gantt_data):
    if not gantt_data:
        return 0
    return max(item["end_time"] for item in gantt_data)


def compute_total_flow_time(job_completion_times):
    if not job_completion_times:
        return 0
    return sum(job_completion_times.values())


def compute_average_flow_time(job_completion_times):
    if not job_completion_times:
        return 0
    return int(sum(job_completion_times.values()) / len(job_completion_times))


def build_job_completion_details(
    job_sequence,
    job_completion_times,
    planning_anchor_date,
):
    details = []

    for job in job_sequence:
        completion_minutes = job_completion_times.get(job.id, 0)

        due_minutes = None
        lateness_minutes = None
        tardiness_minutes = 0

        if job.due_date is not None:
            due_offset_days = max((job.due_date - planning_anchor_date).days, 0)
            due_minutes = due_offset_days * WORKDAY_MINUTES
            lateness_minutes = completion_minutes - due_minutes
            tardiness_minutes = max(lateness_minutes, 0)

        details.append(
            {
                "job_id": job.id,
                "job_code": job.code,
                "job_name": job.name,
                "completion_minutes": completion_minutes,
                "due_date": job.due_date.isoformat() if job.due_date else None,
                "due_minutes": due_minutes,
                "lateness_minutes": lateness_minutes,
                "tardiness_minutes": tardiness_minutes,
            }
        )

    return details


def compute_tardiness_summary(job_completion_details):
    tardiness_values = [
        item["tardiness_minutes"] for item in job_completion_details
    ]

    total_tardiness = sum(tardiness_values)
    average_tardiness = (
        int(total_tardiness / len(tardiness_values))
        if tardiness_values
        else 0
    )
    max_tardiness = max(tardiness_values) if tardiness_values else 0
    late_jobs_count = sum(1 for value in tardiness_values if value > 0)

    return {
        "total_tardiness_minutes": total_tardiness,
        "average_tardiness_minutes": average_tardiness,
        "max_tardiness_minutes": max_tardiness,
        "late_jobs_count": late_jobs_count,
    }


def build_machine_statistics(gantt_data, cmax_minutes):
    machine_map = {}

    for item in gantt_data:
        machine_id = item["machine_id"]

        if machine_id not in machine_map:
            machine_map[machine_id] = {
                "machine_id": machine_id,
                "machine_code": item["machine_code"],
                "machine_name": item["machine_name"],
                "operation_count": 0,
                "setup_minutes": 0,
                "processing_minutes": 0,
                "busy_minutes": 0,
                "idle_minutes": 0,
                "utilization_rate": 0.0,
            }

        machine_map[machine_id]["operation_count"] += 1
        machine_map[machine_id]["setup_minutes"] += item["setup_time"]
        machine_map[machine_id]["processing_minutes"] += item["processing_time"]
        machine_map[machine_id]["busy_minutes"] += (
            item["setup_time"] + item["processing_time"]
        )

    machine_statistics = list(machine_map.values())

    for machine in machine_statistics:
        machine["idle_minutes"] = max(
            cmax_minutes - machine["busy_minutes"],
            0,
        )
        machine["utilization_rate"] = round(
            (machine["busy_minutes"] / cmax_minutes) * 100,
            2,
        ) if cmax_minutes > 0 else 0.0

    machine_statistics.sort(key=lambda item: item["machine_code"])
    return machine_statistics


def build_result_metrics(
    job_sequence,
    gantt_data,
    job_completion_times,
    planning_anchor_date,
):
    cmax_minutes = compute_cmax(gantt_data)
    total_flow_time_minutes = compute_total_flow_time(job_completion_times)
    average_flow_time_minutes = compute_average_flow_time(job_completion_times)

    job_completion_details = build_job_completion_details(
        job_sequence=job_sequence,
        job_completion_times=job_completion_times,
        planning_anchor_date=planning_anchor_date,
    )

    tardiness_summary = compute_tardiness_summary(job_completion_details)
    machine_statistics = build_machine_statistics(
        gantt_data=gantt_data,
        cmax_minutes=cmax_minutes,
    )

    return {
        "total_jobs": len(job_sequence),
        "scheduled_operations": len(gantt_data),
        "cmax_minutes": cmax_minutes,
        "total_flow_time_minutes": total_flow_time_minutes,
        "average_flow_time_minutes": average_flow_time_minutes,
        "total_tardiness_minutes": tardiness_summary["total_tardiness_minutes"],
        "average_tardiness_minutes": tardiness_summary["average_tardiness_minutes"],
        "max_tardiness_minutes": tardiness_summary["max_tardiness_minutes"],
        "late_jobs_count": tardiness_summary["late_jobs_count"],
        "on_time_jobs_count": len(job_sequence) - tardiness_summary["late_jobs_count"],
        "job_completion_details": job_completion_details,
        "machine_statistics": machine_statistics,
    }
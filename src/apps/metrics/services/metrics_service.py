WORKDAY_MINUTES = 480


def compute_cmax(gantt_data):
    if not gantt_data:
        return 0
    return max(item["end_time"] for item in gantt_data)


def compute_total_flow_time(job_completion_times):
    if not job_completion_times:
        return 0
    return sum(job_completion_times.values())


def compute_average_tardiness(job_sequence, job_completion_times, planning_anchor_date):
    tardiness_values = []

    for job in job_sequence:
        if job.due_date is None:
            continue

        due_offset_days = max((job.due_date - planning_anchor_date).days, 0)
        due_minutes = due_offset_days * WORKDAY_MINUTES
        completion_minutes = job_completion_times.get(job.id, 0)

        tardiness = max(completion_minutes - due_minutes, 0)
        tardiness_values.append(tardiness)

    if not tardiness_values:
        return 0

    return int(sum(tardiness_values) / len(tardiness_values))


def build_result_metrics(job_sequence, gantt_data, job_completion_times, planning_anchor_date):
    return {
        "total_jobs": len(job_sequence),
        "scheduled_operations": len(gantt_data),
        "cmax_minutes": compute_cmax(gantt_data),
        "total_flow_time_minutes": compute_total_flow_time(job_completion_times),
        "average_tardiness_minutes": compute_average_tardiness(
            job_sequence=job_sequence,
            job_completion_times=job_completion_times,
            planning_anchor_date=planning_anchor_date,
        ),
    }
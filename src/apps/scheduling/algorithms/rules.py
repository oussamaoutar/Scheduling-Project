from datetime import date


def _job_due_date_key(job):
    return job.due_date or date.max


def sort_jobs_by_spt(jobs):
    return sorted(
        jobs,
        key=lambda job: (
            job.total_processing_time,
            _job_due_date_key(job),
            job.priority,
            job.code,
        ),
    )


def sort_jobs_by_lpt(jobs):
    return sorted(
        jobs,
        key=lambda job: (
            -job.total_processing_time,
            _job_due_date_key(job),
            job.priority,
            job.code,
        ),
    )


def sort_jobs_by_edd(jobs):
    return sorted(
        jobs,
        key=lambda job: (
            _job_due_date_key(job),
            job.priority,
            job.total_processing_time,
            job.code,
        ),
    )
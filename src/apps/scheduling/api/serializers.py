from rest_framework import serializers

from apps.jobs.models import Job
from apps.scheduling.models import ScheduleRun


class ScheduleRunSerializer(serializers.ModelSerializer):
    job_ids = serializers.PrimaryKeyRelatedField(
        source="jobs",
        many=True,
        queryset=Job.objects.all(),
        required=False,
    )

    class Meta:
        model = ScheduleRun
        fields = [
            "id",
            "name",
            "algorithm",
            "objective",
            "status",
            "job_ids",
            "launched_at",
            "finished_at",
            "cmax_minutes",
            "total_flow_time_minutes",
            "average_tardiness_minutes",
            "job_sequence",
            "gantt_data",
            "result_metrics",
            "error_message",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "launched_at",
            "finished_at",
            "cmax_minutes",
            "total_flow_time_minutes",
            "average_tardiness_minutes",
            "job_sequence",
            "gantt_data",
            "result_metrics",
            "error_message",
            "created_at",
            "updated_at",
        ]
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

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Run name cannot be empty.")

        return value

    def validate_notes(self, value):
        return value.strip()


class ScheduleComparisonRequestSerializer(serializers.Serializer):
    job_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Job.objects.all(),
        required=False,
    )
    algorithms = serializers.ListField(
        child=serializers.ChoiceField(choices=ScheduleRun.Algorithm.choices),
        required=False,
        allow_empty=False,
    )
    ranking_metric = serializers.ChoiceField(
        choices=[
            ("cmax_minutes", "cmax_minutes"),
            ("total_flow_time_minutes", "total_flow_time_minutes"),
            ("average_tardiness_minutes", "average_tardiness_minutes"),
        ],
        required=False,
        default="cmax_minutes",
    )

    def validate_algorithms(self, value):
        unique_algorithms = []
        seen = set()

        for algorithm in value:
            if algorithm not in seen:
                seen.add(algorithm)
                unique_algorithms.append(algorithm)

        return unique_algorithms
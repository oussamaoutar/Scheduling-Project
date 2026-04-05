from rest_framework import serializers

from apps.scheduling.models import ScheduleRun


class ScheduleRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleRun
        fields = [
            "id",
            "name",
            "algorithm",
            "objective",
            "status",
            "launched_at",
            "finished_at",
            "cmax_minutes",
            "total_flow_time_minutes",
            "average_tardiness_minutes",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
from django.contrib import admin

from apps.scheduling.models import ScheduleRun


@admin.register(ScheduleRun)
class ScheduleRunAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "algorithm",
        "objective",
        "status",
        "cmax_minutes",
        "total_flow_time_minutes",
        "average_tardiness_minutes",
        "launched_at",
        "finished_at",
        "created_at",
    )
    list_filter = ("algorithm", "objective", "status")
    search_fields = ("name", "notes", "error_message")
    ordering = ("-created_at",)
    filter_horizontal = ("jobs",)
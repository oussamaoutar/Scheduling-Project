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
        "launched_at",
        "finished_at",
        "created_at",
    )
    list_filter = ("algorithm", "objective", "status")
    search_fields = ("name", "notes")
    ordering = ("-created_at",)
from django.contrib import admin

from apps.machines.models import Machine


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "machine_type",
        "workstation_number",
        "capacity_per_day",
        "is_active",
        "created_at",
    )
    list_filter = ("machine_type", "is_active")
    search_fields = ("code", "name")
    ordering = ("workstation_number", "code")
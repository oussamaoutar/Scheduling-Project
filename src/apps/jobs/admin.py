from django.contrib import admin

from apps.jobs.models import Job, Operation


class OperationInline(admin.TabularInline):
    model = Operation
    extra = 1


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "quantity",
        "priority",
        "status",
        "release_date",
        "due_date",
        "is_active",
        "created_at",
    )
    list_filter = ("status", "is_active", "priority")
    search_fields = ("code", "name")
    ordering = ("due_date", "priority", "code")
    inlines = [OperationInline]


@admin.register(Operation)
class OperationAdmin(admin.ModelAdmin):
    list_display = (
        "job",
        "machine",
        "sequence_order",
        "processing_time_minutes",
        "setup_time_minutes",
        "transfer_time_minutes",
    )
    list_filter = ("machine",)
    search_fields = ("job__code", "job__name", "machine__code", "machine__name")
    ordering = ("job", "sequence_order")
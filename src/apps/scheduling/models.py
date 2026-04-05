from django.db import models

from apps.common.models import TimeStampedModel


class ScheduleRun(TimeStampedModel):
    class Algorithm(models.TextChoices):
        SPT = "spt", "SPT"
        LPT = "lpt", "LPT"
        EDD = "edd", "EDD"
        JOHNSON = "johnson", "Johnson"
        CDS = "cds", "CDS"

    class RunStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class Objective(models.TextChoices):
        MINIMIZE_CMAX = "minimize_cmax", "Minimize Cmax"
        MINIMIZE_TARDINESS = "minimize_tardiness", "Minimize Tardiness"
        BALANCE_LOAD = "balance_load", "Balance Load"

    name = models.CharField(max_length=120)
    algorithm = models.CharField(
        max_length=20,
        choices=Algorithm.choices,
    )
    objective = models.CharField(
        max_length=30,
        choices=Objective.choices,
        default=Objective.MINIMIZE_CMAX,
    )
    status = models.CharField(
        max_length=20,
        choices=RunStatus.choices,
        default=RunStatus.DRAFT,
    )
    launched_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    cmax_minutes = models.PositiveIntegerField(null=True, blank=True)
    total_flow_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    average_tardiness_minutes = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Schedule run"
        verbose_name_plural = "Schedule runs"

    def __str__(self):
        return f"{self.name} - {self.algorithm}"
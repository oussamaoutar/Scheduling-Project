from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel
from apps.machines.models import Machine


class Job(TimeStampedModel):
    class JobStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        READY = "ready", "Ready"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
    )
    release_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    priority = models.PositiveSmallIntegerField(default=3)
    status = models.CharField(
        max_length=20,
        choices=JobStatus.choices,
        default=JobStatus.DRAFT,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["due_date", "priority", "code"]
        verbose_name = "Job"
        verbose_name_plural = "Jobs"

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def total_processing_time(self):
        return sum(
            operation.processing_time_minutes + operation.setup_time_minutes
            for operation in self.operations.all()
        )


class Operation(TimeStampedModel):
    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="operations",
    )
    machine = models.ForeignKey(
        Machine,
        on_delete=models.PROTECT,
        related_name="operations",
    )
    sequence_order = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Operation order inside the routing of the job.",
    )
    processing_time_minutes = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
    )
    setup_time_minutes = models.PositiveIntegerField(default=0)
    transfer_time_minutes = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["job", "sequence_order"]
        verbose_name = "Operation"
        verbose_name_plural = "Operations"
        constraints = [
            models.UniqueConstraint(
                fields=["job", "sequence_order"],
                name="unique_operation_order_per_job",
            ),
            models.UniqueConstraint(
                fields=["job", "machine"],
                name="unique_machine_once_per_job",
            ),
        ]

    def __str__(self):
        return (
            f"{self.job.code} - Op{self.sequence_order} - "
            f"{self.machine.code}"
        )

    @property
    def total_time_minutes(self):
        return (
            self.processing_time_minutes
            + self.setup_time_minutes
            + self.transfer_time_minutes
        )
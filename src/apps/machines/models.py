from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel


class Machine(TimeStampedModel):
    class MachineType(models.TextChoices):
        CUTTING = "cutting", "Cutting"
        DRILLING = "drilling", "Drilling"
        MILLING = "milling", "Milling"
        TURNING = "turning", "Turning"
        ASSEMBLY = "assembly", "Assembly"
        PAINTING = "painting", "Painting"
        PACKAGING = "packaging", "Packaging"
        OTHER = "other", "Other"

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=120)
    machine_type = models.CharField(
        max_length=20,
        choices=MachineType.choices,
        default=MachineType.OTHER,
    )
    description = models.TextField(blank=True)
    workstation_number = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        unique=True,
    )
    capacity_per_day = models.PositiveIntegerField(
        default=480,
        validators=[MinValueValidator(1)],
        help_text="Available production time in minutes per day.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["workstation_number", "code"]
        verbose_name = "Machine"
        verbose_name_plural = "Machines"

    def __str__(self):
        return f"{self.code} - {self.name}"
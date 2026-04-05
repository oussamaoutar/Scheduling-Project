from rest_framework import serializers

from apps.machines.models import Machine


class MachineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Machine
        fields = [
            "id",
            "code",
            "name",
            "machine_type",
            "description",
            "workstation_number",
            "capacity_per_day",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
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

    def validate_code(self, value):
        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError("Machine code cannot be empty.")

        return value

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Machine name cannot be empty.")

        return value

    def validate_description(self, value):
        return value.strip()
from rest_framework import serializers

from apps.jobs.models import Job, Operation


class OperationSerializer(serializers.ModelSerializer):
    machine_code = serializers.CharField(source="machine.code", read_only=True)
    machine_name = serializers.CharField(source="machine.name", read_only=True)

    class Meta:
        model = Operation
        fields = [
            "id",
            "job",
            "machine",
            "machine_code",
            "machine_name",
            "sequence_order",
            "processing_time_minutes",
            "setup_time_minutes",
            "transfer_time_minutes",
            "notes",
            "total_time_minutes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "machine_code",
            "machine_name",
            "total_time_minutes",
            "created_at",
            "updated_at",
        ]

    def validate_notes(self, value):
        return value.strip()

    def validate(self, attrs):
        job = attrs.get("job", getattr(self.instance, "job", None))
        machine = attrs.get("machine", getattr(self.instance, "machine", None))
        sequence_order = attrs.get(
            "sequence_order",
            getattr(self.instance, "sequence_order", None),
        )

        if job is None or machine is None or sequence_order is None:
            return attrs

        if not job.is_active:
            raise serializers.ValidationError(
                {"job": "Selected job is inactive."}
            )

        if not machine.is_active:
            raise serializers.ValidationError(
                {"machine": "Selected machine is inactive."}
            )

        existing_operations = Operation.objects.filter(job=job)

        if self.instance is not None:
            existing_operations = existing_operations.exclude(pk=self.instance.pk)

        if existing_operations.filter(sequence_order=sequence_order).exists():
            raise serializers.ValidationError(
                {
                    "sequence_order": (
                        "This sequence order already exists for the selected job."
                    )
                }
            )

        if existing_operations.filter(machine=machine).exists():
            raise serializers.ValidationError(
                {
                    "machine": (
                        "This machine is already assigned to the selected job."
                    )
                }
            )

        return attrs


class JobSerializer(serializers.ModelSerializer):
    total_processing_time = serializers.IntegerField(read_only=True)

    class Meta:
        model = Job
        fields = [
            "id",
            "code",
            "name",
            "description",
            "quantity",
            "release_date",
            "due_date",
            "priority",
            "status",
            "is_active",
            "total_processing_time",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "total_processing_time", "created_at", "updated_at"]

    def validate_code(self, value):
        value = value.strip().upper()

        if not value:
            raise serializers.ValidationError("Job code cannot be empty.")

        return value

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Job name cannot be empty.")

        return value

    def validate_description(self, value):
        return value.strip()

    def validate_priority(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Priority must be between 1 and 5.")
        return value

    def validate(self, attrs):
        release_date = attrs.get(
            "release_date",
            getattr(self.instance, "release_date", None),
        )
        due_date = attrs.get(
            "due_date",
            getattr(self.instance, "due_date", None),
        )

        if release_date and due_date and due_date < release_date:
            raise serializers.ValidationError(
                {
                    "due_date": (
                        "Due date must be greater than or equal to release date."
                    )
                }
            )

        return attrs


class JobDetailSerializer(serializers.ModelSerializer):
    operations = OperationSerializer(many=True, read_only=True)
    total_processing_time = serializers.IntegerField(read_only=True)

    class Meta:
        model = Job
        fields = [
            "id",
            "code",
            "name",
            "description",
            "quantity",
            "release_date",
            "due_date",
            "priority",
            "status",
            "is_active",
            "total_processing_time",
            "operations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "total_processing_time", "created_at", "updated_at"]
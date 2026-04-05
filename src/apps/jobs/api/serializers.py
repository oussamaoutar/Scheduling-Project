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
from rest_framework import filters, viewsets

from apps.jobs.api.serializers import (
    JobDetailSerializer,
    JobSerializer,
    OperationSerializer,
)
from apps.jobs.models import Job, Operation


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all().order_by("due_date", "priority", "code")
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "status"]
    ordering_fields = [
        "code",
        "name",
        "priority",
        "due_date",
        "release_date",
        "created_at",
    ]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return JobDetailSerializer
        return JobSerializer


class OperationViewSet(viewsets.ModelViewSet):
    queryset = Operation.objects.select_related("job", "machine").all().order_by(
        "job", "sequence_order"
    )
    serializer_class = OperationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["job__code", "job__name", "machine__code", "machine__name"]
    ordering_fields = [
        "sequence_order",
        "processing_time_minutes",
        "setup_time_minutes",
        "created_at",
    ]
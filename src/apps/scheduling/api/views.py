from rest_framework import filters, viewsets

from apps.scheduling.api.serializers import ScheduleRunSerializer
from apps.scheduling.models import ScheduleRun


class ScheduleRunViewSet(viewsets.ModelViewSet):
    queryset = ScheduleRun.objects.all().order_by("-created_at")
    serializer_class = ScheduleRunSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "algorithm", "objective", "status"]
    ordering_fields = [
        "created_at",
        "name",
        "algorithm",
        "status",
        "cmax_minutes",
    ]
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.scheduling.api.serializers import ScheduleRunSerializer
from apps.scheduling.models import ScheduleRun
from apps.scheduling.services.schedule_service import ScheduleService


class ScheduleRunViewSet(viewsets.ModelViewSet):
    queryset = ScheduleRun.objects.prefetch_related("jobs").all().order_by("-created_at")
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

    @action(detail=True, methods=["post"], url_path="execute")
    def execute(self, request, pk=None):
        schedule_run = self.get_object()
        service = ScheduleService()

        try:
            updated_run = service.execute_run(schedule_run)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = self.get_serializer(updated_run)
        return Response(serializer.data, status=status.HTTP_200_OK)
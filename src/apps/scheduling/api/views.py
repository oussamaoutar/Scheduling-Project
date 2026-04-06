from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.scheduling.api.serializers import (
    ScheduleComparisonRequestSerializer,
    ScheduleRunSerializer,
)
from apps.scheduling.models import ScheduleRun
from apps.scheduling.services.dashboard_service import SchedulingDashboardService
from apps.scheduling.services.schedule_service import ScheduleService


class ScheduleRunViewSet(viewsets.ModelViewSet):
    queryset = ScheduleRun.objects.prefetch_related("jobs").all().order_by("-created_at")
    serializer_class = ScheduleRunSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = {
        "algorithm": ["exact"],
        "objective": ["exact"],
        "status": ["exact"],
        "created_at": ["date", "date__gte", "date__lte"],
    }
    search_fields = ["name", "algorithm", "objective", "status"]
    ordering_fields = [
        "created_at",
        "name",
        "algorithm",
        "status",
        "cmax_minutes",
        "total_flow_time_minutes",
        "average_tardiness_minutes",
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


class SchedulingAlgorithmsAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        service = ScheduleService()
        return Response(service.get_algorithm_catalog(), status=status.HTTP_200_OK)


class SchedulingComparisonAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = ScheduleComparisonRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        selected_jobs = serializer.validated_data.get("job_ids")
        algorithms = serializer.validated_data.get("algorithms")
        ranking_metric = serializer.validated_data.get(
            "ranking_metric",
            "cmax_minutes",
        )

        service = ScheduleService()

        try:
            comparison_result = service.compare_algorithms(
                selected_jobs=selected_jobs,
                algorithms=algorithms,
                ranking_metric=ranking_metric,
            )
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

        return Response(comparison_result, status=status.HTTP_200_OK)


class SchedulingDashboardAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        service = SchedulingDashboardService()
        return Response(service.build_dashboard_summary(), status=status.HTTP_200_OK)


class ScheduleRunSummaryAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, pk):
        schedule_run = get_object_or_404(
            ScheduleRun.objects.prefetch_related("jobs"),
            pk=pk,
        )
        service = SchedulingDashboardService()
        return Response(service.build_run_summary(schedule_run), status=status.HTTP_200_OK)


class ScheduleRunKPIsAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, pk):
        schedule_run = get_object_or_404(
            ScheduleRun.objects.prefetch_related("jobs"),
            pk=pk,
        )
        service = SchedulingDashboardService()
        return Response(service.build_run_kpis(schedule_run), status=status.HTTP_200_OK)


class ScheduleRunGanttAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, pk):
        schedule_run = get_object_or_404(
            ScheduleRun.objects.prefetch_related("jobs"),
            pk=pk,
        )
        service = SchedulingDashboardService()
        return Response(service.build_run_gantt(schedule_run), status=status.HTTP_200_OK)
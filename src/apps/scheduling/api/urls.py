from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.scheduling.api.views import (
    ScheduleRunGanttAPIView,
    ScheduleRunKPIsAPIView,
    ScheduleRunSummaryAPIView,
    ScheduleRunViewSet,
    SchedulingAlgorithmsAPIView,
    SchedulingComparisonAPIView,
    SchedulingDashboardAPIView,
)

router = DefaultRouter()
router.register("runs", ScheduleRunViewSet, basename="schedule-run")

urlpatterns = [
    path("dashboard/", SchedulingDashboardAPIView.as_view(), name="scheduling-dashboard"),
    path("algorithms/", SchedulingAlgorithmsAPIView.as_view(), name="scheduling-algorithms"),
    path("compare/", SchedulingComparisonAPIView.as_view(), name="scheduling-compare"),
    path("runs/<int:pk>/summary/", ScheduleRunSummaryAPIView.as_view(), name="schedule-run-summary"),
    path("runs/<int:pk>/kpis/", ScheduleRunKPIsAPIView.as_view(), name="schedule-run-kpis"),
    path("runs/<int:pk>/gantt/", ScheduleRunGanttAPIView.as_view(), name="schedule-run-gantt"),
    path("", include(router.urls)),
]
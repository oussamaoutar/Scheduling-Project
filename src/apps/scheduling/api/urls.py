from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.scheduling.api.views import (
    ScheduleRunViewSet,
    SchedulingAlgorithmsAPIView,
    SchedulingComparisonAPIView,
)

router = DefaultRouter()
router.register("runs", ScheduleRunViewSet, basename="schedule-run")

urlpatterns = [
    path("algorithms/", SchedulingAlgorithmsAPIView.as_view(), name="scheduling-algorithms"),
    path("compare/", SchedulingComparisonAPIView.as_view(), name="scheduling-compare"),
    path("", include(router.urls)),
]
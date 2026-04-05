from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.scheduling.api.views import ScheduleRunViewSet

router = DefaultRouter()
router.register("runs", ScheduleRunViewSet, basename="schedule-run")

urlpatterns = [
    path("", include(router.urls)),
]
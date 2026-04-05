from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.jobs.api.views import JobViewSet, OperationViewSet

router = DefaultRouter()
router.register("operations", OperationViewSet, basename="operation")
router.register("", JobViewSet, basename="job")

urlpatterns = [
    path("", include(router.urls)),
]
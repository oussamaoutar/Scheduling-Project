from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.machines.api.views import MachineViewSet

router = DefaultRouter()
router.register("", MachineViewSet, basename="machine")

urlpatterns = [
    path("", include(router.urls)),
]
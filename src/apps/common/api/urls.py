from django.urls import path

from apps.common.api.views import HealthCheckAPIView

urlpatterns = [
    path("health/", HealthCheckAPIView.as_view(), name="health-check"),
]
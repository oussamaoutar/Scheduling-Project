from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/", include("apps.common.api.urls")),
    path("api/machines/", include("apps.machines.api.urls")),
    path("api/jobs/", include("apps.jobs.api.urls")),
    path("api/scheduling/", include("apps.scheduling.api.urls")),
]
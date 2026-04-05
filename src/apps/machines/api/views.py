from rest_framework import filters, viewsets

from apps.machines.api.serializers import MachineSerializer
from apps.machines.models import Machine


class MachineViewSet(viewsets.ModelViewSet):
    queryset = Machine.objects.all().order_by("workstation_number", "code")
    serializer_class = MachineSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "machine_type"]
    ordering_fields = ["workstation_number", "code", "name", "created_at"]
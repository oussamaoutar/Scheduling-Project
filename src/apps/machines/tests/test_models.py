from django.test import TestCase

from apps.machines.models import Machine


class MachineModelTestCase(TestCase):
    def test_machine_string_representation(self):
        machine = Machine.objects.create(
            code="M1",
            name="Cutting Machine",
            workstation_number=1,
        )

        self.assertEqual(str(machine), "M1 - Cutting Machine")
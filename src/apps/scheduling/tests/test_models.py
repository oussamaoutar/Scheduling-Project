from django.test import TestCase

from apps.scheduling.models import ScheduleRun


class ScheduleRunModelTestCase(TestCase):
    def test_schedule_run_string_representation(self):
        schedule_run = ScheduleRun.objects.create(
            name="Initial Run",
            algorithm=ScheduleRun.Algorithm.SPT,
        )

        self.assertEqual(str(schedule_run), "Initial Run - spt")
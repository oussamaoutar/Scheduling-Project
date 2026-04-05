def johnson_order(job_profiles):
    remaining_profiles = list(job_profiles)
    left_sequence = []
    right_sequence = []

    while remaining_profiles:
        selected_profile = min(
            remaining_profiles,
            key=lambda profile: min(profile["times"][0], profile["times"][1]),
        )

        first_machine_time = selected_profile["times"][0]
        second_machine_time = selected_profile["times"][1]

        if first_machine_time <= second_machine_time:
            left_sequence.append(selected_profile)
        else:
            right_sequence.insert(0, selected_profile)

        remaining_profiles = [
            profile
            for profile in remaining_profiles
            if profile["job_id"] != selected_profile["job_id"]
        ]

    return left_sequence + right_sequence
from apps.scheduling.algorithms.johnson import johnson_order


def compute_flow_shop_cmax(job_profiles, ordered_job_ids):
    if not job_profiles:
        return 0

    profile_map = {profile["job_id"]: profile for profile in job_profiles}
    machine_count = len(job_profiles[0]["times"])
    machine_completion_times = [0] * machine_count

    for job_id in ordered_job_ids:
        processing_times = profile_map[job_id]["times"]

        machine_completion_times[0] += processing_times[0]

        for machine_index in range(1, machine_count):
            machine_completion_times[machine_index] = max(
                machine_completion_times[machine_index],
                machine_completion_times[machine_index - 1],
            ) + processing_times[machine_index]

    return machine_completion_times[-1]


def cds_order(job_profiles):
    if not job_profiles:
        return [], {"selected_k": None, "estimated_cmax": 0}

    machine_count = len(job_profiles[0]["times"])

    if machine_count < 3:
        raise ValueError("CDS requires at least 3 machines.")

    best_sequence_ids = None
    best_metadata = None

    for k in range(1, machine_count):
        virtual_profiles = []

        for profile in job_profiles:
            first_virtual_machine = sum(profile["times"][:k])
            second_virtual_machine = sum(profile["times"][k:])

            virtual_profiles.append(
                {
                    "job": profile["job"],
                    "job_id": profile["job_id"],
                    "job_code": profile["job_code"],
                    "times": [first_virtual_machine, second_virtual_machine],
                }
            )

        ordered_virtual_profiles = johnson_order(virtual_profiles)
        ordered_job_ids = [
            profile["job_id"] for profile in ordered_virtual_profiles
        ]

        estimated_cmax = compute_flow_shop_cmax(job_profiles, ordered_job_ids)

        if (
            best_metadata is None
            or estimated_cmax < best_metadata["estimated_cmax"]
        ):
            best_sequence_ids = ordered_job_ids
            best_metadata = {
                "selected_k": k,
                "estimated_cmax": estimated_cmax,
            }

    profile_map = {profile["job_id"]: profile for profile in job_profiles}
    ordered_profiles = [profile_map[job_id] for job_id in best_sequence_ids]

    return ordered_profiles, best_metadata
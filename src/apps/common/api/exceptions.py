from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return response

    detail = "Request could not be processed."
    field_errors = None

    if isinstance(response.data, dict):
        if "detail" in response.data:
            detail = response.data["detail"]
        elif "non_field_errors" in response.data:
            non_field_errors = response.data["non_field_errors"]
            if isinstance(non_field_errors, list) and non_field_errors:
                detail = non_field_errors[0]
            else:
                detail = non_field_errors
        else:
            field_errors = response.data

            first_key = next(iter(response.data), None)
            if first_key is not None:
                first_value = response.data[first_key]
                if isinstance(first_value, list) and first_value:
                    detail = first_value[0]
                else:
                    detail = first_value

    elif isinstance(response.data, list) and response.data:
        detail = response.data[0]
    else:
        detail = str(response.data)

    response.data = {
        "success": False,
        "error": {
            "status_code": response.status_code,
            "type": exc.__class__.__name__,
            "detail": detail,
            "field_errors": field_errors,
        },
    }

    return response
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response

class ObtainAuthTokenWithRole(ObtainAuthToken):
    """
    POST {username, password} → {token, role}
    Role = first group name (“owner” | “higher-up” | “employee”).
    """
    def post(self, request, *args, **kwargs):
        # let DRF validate the creds and create / fetch the token
        response = super().post(request, *args, **kwargs)
        key   = response.data["token"]
        user  = Token.objects.get(key=key).user
        role  = user.groups.first().name if user.groups.exists() else ""
        return Response({"token": key, "role": role})

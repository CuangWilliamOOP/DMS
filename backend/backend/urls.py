# backend/backend/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from documents.views import (
    DocumentViewSet,
    SupportingDocumentViewSet,
    parse_and_store_view,
    login_view,  # <-- add this import
    user_info,   # <-- import user_info
    UserSettingsView,
)
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = routers.DefaultRouter()
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'supporting-docs', SupportingDocumentViewSet, basename='supporting-doc')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),

    # The new GPT parse + store route
    path('api/parse-and-store/', parse_and_store_view, name='parse_and_store'),
    path('api/login/', login_view, name='login'),  # <-- add this route
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/me/', user_info),  # <-- add user_info endpoint
    path("api/user-settings/", UserSettingsView.as_view(), name="user_settings"),
]

# Serve media in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

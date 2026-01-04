# backend/backend/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from documents.views import (
    DocumentViewSet,
    SupportingDocumentViewSet,
    parse_and_store_view,
    progress_view,
    login_view,
    user_info,
    UserSettingsView,
    PaymentProofViewSet,
    sdoc_preview,
    rekap_view,
    kebun_outline_view,
    kebun_blocks_view,
    kebun_blocks_meta_view,
    otp_login_start,
    otp_login_verify,
    otp_password_change_start,
    otp_password_change_confirm,
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
router.register(r'payment-proofs', PaymentProofViewSet, basename='payment-proof')  # <-- add this line

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),

    # The new GPT parse + store route
    path('api/parse-and-store/', parse_and_store_view, name='parse_and_store'),
    path('api/progress/<str:job_id>/', progress_view, name='progress_view'),
    path('api/rekap/<str:company_code>/<str:rekap_key>/', rekap_view, name='rekap'),
    path('api/login/', login_view, name='login'),  # <-- add this route
    path("api/auth/login/start/", otp_login_start, name="otp_login_start"),
    path("api/auth/login/verify/", otp_login_verify, name="otp_login_verify"),
    path("api/auth/password/start/", otp_password_change_start, name="otp_password_change_start"),
    path("api/auth/password/confirm/", otp_password_change_confirm, name="otp_password_change_confirm"),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/me/', user_info),  # <-- add user_info endpoint
    path("api/user-settings/", UserSettingsView.as_view(), name="user_settings"),
    path("api/sdoc/<int:pk>/preview", sdoc_preview, name="sdoc_preview"),

    # NEW: kebun outline (GeoJSON)
    path(
        "api/maps/<slug:estate_code>/outline/",
        kebun_outline_view,
        name="kebun_outline",
    ),
    path(
        "api/maps/<slug:estate_code>/blocks/",
        kebun_blocks_view,
        name="kebun_blocks",
    ),
    path(
        "api/maps/<slug:estate_code>/blocks-meta/",
        kebun_blocks_meta_view,
        name="kebun_blocks_meta",
    ),
]

# Serve media in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

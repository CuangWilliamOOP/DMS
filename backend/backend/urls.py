# backend/backend/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers
from documents.views import (
    DocumentViewSet,
    SupportingDocumentViewSet,
    parse_and_store_view
)
from django.conf import settings
from django.conf.urls.static import static

router = routers.DefaultRouter()
router.register(r'documents', DocumentViewSet, basename='document')
router.register(r'supporting-docs', SupportingDocumentViewSet, basename='supporting-doc')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),

    # The new GPT parse + store route
    path('api/parse-and-store/', parse_and_store_view, name='parse_and_store'),
]

# Serve media in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

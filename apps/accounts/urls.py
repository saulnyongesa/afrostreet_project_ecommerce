# apps/accounts/urls.py
from django.urls import path
from . import api_views

urlpatterns = [
    path('register/', api_views.ajax_register, name='api-register'),
    path('login/', api_views.ajax_login, name='api-login'),
    path('logout/', api_views.ajax_logout, name='api-logout'),
]
# apps/search/urls.py
from django.urls import path
from . import api_views

urlpatterns = [
    # Endpoints pending creation in the next step
    path('autocomplete/', api_views.search_autocomplete, name='api-search-autocomplete'),
    path('results/', api_views.execute_search, name='api-search-results'),
]
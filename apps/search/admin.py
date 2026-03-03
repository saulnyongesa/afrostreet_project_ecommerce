# apps/search/admin.py
from django.contrib import admin
from .models import SearchQuery

@admin.register(SearchQuery)
class SearchQueryAdmin(admin.ModelAdmin):
    list_display = ('query_text', 'frequency', 'last_searched')
    search_fields = ('query_text',)
    ordering = ('-frequency',)
    readonly_fields = ('last_searched',)
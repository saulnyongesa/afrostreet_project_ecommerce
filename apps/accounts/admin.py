# apps/accounts/admin.py
from django.contrib import admin
from .models import CustomUser

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'is_staff', 'is_active', 'date_joined')
    search_fields = ('email', 'full_name')
    list_filter = ('is_staff', 'is_active')
    ordering = ('-date_joined',)
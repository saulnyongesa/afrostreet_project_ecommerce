# apps/store/admin_views.py
from django.shortcuts import render, redirect
from django.contrib.admin.views.decorators import staff_member_required

from apps.store.models import Category

@staff_member_required(login_url='/')
def dashboard_view(request):
    """
    Renders the main custom admin analytics dashboard.
    Only accessible by users where is_staff=True.
    """
    return render(request, 'custom_admin/dashboard.html')

@staff_member_required(login_url='/')
def article_management_view(request):
    """Renders the blog CMS interface."""
    return render(request, 'custom_admin/articles.html')

@staff_member_required(login_url='/')
def order_management_view(request):
    """Renders the Order Management CMS interface."""
    return render(request, 'custom_admin/orders.html')

@staff_member_required(login_url='/')
def product_management_view(request):
    """Renders the Product Management CMS interface."""
    categories = Category.objects.all()
    return render(request, 'custom_admin/products.html', {'categories': categories})

@staff_member_required(login_url='/')
def promotions_management_view(request):
    """Renders the Promotions & Banners CMS interface."""
    return render(request, 'custom_admin/promotions_manager.html')
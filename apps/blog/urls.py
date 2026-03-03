# apps/blog/urls.py
from django.urls import path
from . import api_views

urlpatterns = [
    path('articles/', api_views.get_published_articles, name='api-articles-list'),
    path('articles/<slug:slug>/', api_views.get_article_detail, name='api-article-detail'),
    path('admin/articles/', api_views.admin_manage_articles, name='api-admin-articles'),
    path('admin/articles/<int:pk>/', api_views.admin_article_detail, name='api-admin-article-detail'),
]
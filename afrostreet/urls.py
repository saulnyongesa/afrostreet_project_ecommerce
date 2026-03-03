# afrostreet/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Import the view we just created
from apps.blog.views import blog_detail_page, blog_list_page
from apps.store.admin_views import article_management_view, dashboard_view, order_management_view, product_management_view, promotions_management_view
from apps.store.views import home_page, my_orders_page, product_detail_page , category_detail_page, checkout_page, promotions_page

urlpatterns = [
    # Frontend Pages
    path('', home_page, name='home'),
    path('product/<slug:slug>/', product_detail_page, name='product-detail'), # New Route
    path('blog/', blog_list_page, name='blog-list'),
    path('blog/<slug:slug>/', blog_detail_page, name='blog-detail'),
    path('product/<slug:slug>/', product_detail_page, name='product-detail'),
    path('category/<slug:slug>/', category_detail_page, name='category-detail'), # New Route
    path('checkout/', checkout_page, name='checkout'),
    path('my-orders/', my_orders_page, name='my-orders'), 
    path('promotions/<str:promo_type>/', promotions_page, name='promotions'),
    # Admin & CKEditor
    path('hq/', dashboard_view, name='admin_dashboard'),
    path('hq/articles/', article_management_view, name='admin_articles'),
    path('hq/orders/', order_management_view, name='admin_orders'),
    path('hq/products/', product_management_view, name='admin_products'),
    path('hq/promotions/', promotions_management_view, name='admin_promotions'),

    path('admin/', admin.site.urls),
    path("ckeditor5/", include('django_ckeditor_5.urls')),
    
    # API Routing
    path('api/accounts/', include('apps.accounts.urls')),
    path('api/store/', include('apps.store.urls')),
    path('api/blog/', include('apps.blog.urls')),
    path('api/search/', include('apps.search.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
# apps/store/urls.py
from django.urls import path
from . import api_views

urlpatterns = [
    path('categories/', api_views.get_categories, name='api-categories'),
    path('banners/', api_views.get_active_banners, name='api-banners'),
    path('products/', api_views.get_products, name='api-products'),
    path('deals-and-offers/', api_views.get_deals_and_offers, name='api-deals-offers'),
    path('products/<slug:slug>/', api_views.get_product_detail, name='api-product-detail'),
    path('products/<slug:slug>/related/', api_views.get_smart_related_products, name='api-product-related'),
    path('recently-viewed/', api_views.get_recently_viewed, name='api-recently-viewed'),
    path('checkout/process/', api_views.process_checkout, name='api-checkout-process'),
    path('orders/my-orders/', api_views.get_my_orders, name='api-my-orders'), # New route!
    # M-Pesa STK Routes
    path('mpesa/status/<str:checkout_request_id>/', api_views.check_payment_status, name='api-mpesa-status'),
    path('mpesa/callback/', api_views.mpesa_callback, name='api-mpesa-callback'),
    
    # NEW: M-Pesa C2B Paybill Routes
    path('c2b/validation/', api_views.c2b_validation, name='api-c2b-validation'),
    path('c2b/confirmation/', api_views.c2b_confirmation, name='api-c2b-confirmation'),
    
    # Helper for staff to register URLs
    path('c2b/register-urls/', api_views.register_urls_view, name='api-c2b-register-urls'),

    # Admin API Endpoints (for future use)
    path('admin/upload-image/', api_views.admin_upload_image, name='api-admin-upload-image'),
    path('admin/orders/', api_views.admin_get_orders, name='api-admin-orders'),
    path('admin/orders/<int:pk>/status/', api_views.admin_update_order_status, name='api-admin-order-status'),
    path('admin/users/check-or-create/', api_views.admin_check_or_create_user, name='api-admin-user-check'),
    path('admin/orders/create/', api_views.admin_create_manual_order, name='api-admin-order-create'),
    path('admin/orders/<int:pk>/', api_views.admin_order_detail, name='api-admin-order-detail'),
    path('admin/analytics/', api_views.admin_analytics_data, name='api-admin-analytics'),
    path('admin/analytics/export/pdf/', api_views.admin_export_pdf, name='api-admin-export-pdf'),
    path('admin/products/', api_views.admin_manage_products, name='api-admin-products'),
    path('admin/products/<int:pk>/', api_views.admin_product_detail, name='api-admin-product-detail'),
    path('admin/banners/', api_views.admin_manage_banners, name='api-admin-banners'),
    path('admin/banners/<int:pk>/', api_views.admin_delete_banner, name='api-admin-delete-banner'),
    path('admin/products/<int:pk>/toggle-promo/', api_views.admin_toggle_promotion, name='api-admin-toggle-promo'),
]

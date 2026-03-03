# apps/store/admin.py
from django.contrib import admin
from .models import Category, Order, OrderItem, Product, HeroBanner, RecentlyViewed

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'is_offer', 'is_deal', 'is_active', 'created_at')
    list_filter = ('is_offer', 'is_deal', 'category', 'is_active')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    
@admin.register(HeroBanner)
class HeroBannerAdmin(admin.ModelAdmin):
    list_display = ('title', 'product', 'is_active')
    list_filter = ('is_active',)

@admin.register(RecentlyViewed)
class RecentlyViewedAdmin(admin.ModelAdmin):
    list_display = ('user', 'product', 'viewed_at')
    readonly_fields = ('viewed_at',)
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    readonly_fields = ('product', 'purchase_price', 'quantity')
    can_delete = False
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'total_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('full_name', 'email', 'phone')
    readonly_fields = ('total_amount', 'created_at')
    inlines = [OrderItemInline] # Shows the items inside the order page!
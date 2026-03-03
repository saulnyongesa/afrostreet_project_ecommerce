# apps/store/serializers.py
from rest_framework import serializers
from .models import Order, OrderItem, Product, Category, HeroBanner

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug']

class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'category', 'name', 'slug', 'description', 
            'price', 'image', 'is_offer', 'is_deal', 'discount_price'
        ]

class HeroBannerSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = HeroBanner
        fields = ['id', 'title', 'image', 'product', 'is_active']
    
class OrderItemSerializer(serializers.ModelSerializer):
    # Dynamically pull the product name and image so we don't have to serialize the whole product
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.ImageField(source='product.image', read_only=True)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'product_name', 'product_image', 'quantity', 'purchase_price']

class OrderSerializer(serializers.ModelSerializer):
    # Nest the items inside the order payload
    items = OrderItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Order
        fields = ['id', 'full_name', 'total_amount', 'status', 'created_at', 'items']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Order
        # Add 'mpesa_account_number' right before 'items'
        fields = ['id', 'full_name', 'total_amount', 'status', 'created_at', 'mpesa_account_number', 'items']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    # OVERRIDE: Accept the relative string path from AfroCropper
    image = serializers.CharField(max_length=500, required=True)

    class Meta:
        model = Product
        fields = ['id', 'category', 'category_name', 'name', 'slug', 'description', 'price', 'discount_price', 'image', 'is_active', 'created_at']

class HeroBannerSerializer(serializers.ModelSerializer):
    image = serializers.CharField(max_length=500, required=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    # NEW: Expose the needed product fields as flat properties
    product_slug = serializers.CharField(source='product.slug', read_only=True)
    product_price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)
    product_discount_price = serializers.DecimalField(source='product.discount_price', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = HeroBanner
        # Add the new fields to the fields list
        fields = ['id', 'title', 'image', 'product', 'product_name', 'product_slug', 'product_price', 'product_discount_price', 'is_active']

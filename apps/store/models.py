# apps/store/models.py
from django.db import models
from django.conf import settings
from django_ckeditor_5.fields import CKEditor5Field as RichTextField
class Category(models.Model):
    """Self-referential category model to handle infinite subcategories."""
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subcategories')

    def __str__(self):
        return f"{self.parent.name} -> {self.name}" if self.parent else self.name

class Product(models.Model):
    """Main product model featuring rich text for descriptions."""
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    description = RichTextField() # CKEditor integration
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='products/')
    
    # Flags for Deals & Offers components
    is_offer = models.BooleanField(default=False, help_text="Display in 'Offers' section")
    is_deal = models.BooleanField(default=False, help_text="Display in 'Deals' section")
    discount_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class HeroBanner(models.Model):
    """Dynamic front-page banners linked directly to products."""
    title = models.CharField(max_length=100, help_text="Banner text/title")
    image = models.ImageField(upload_to='banners/')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, help_text="Product to route to on 'Buy Now' click")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.title

class RecentlyViewed(models.Model):
    """Tracks user history for the 'Recently Viewed' user-specific section."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='viewed_history')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-viewed_at']
        unique_together = ('user', 'product') # Prevent duplicate entries per product

class Order(models.Model):
    """Stores the main order details and customer shipping information."""
    STATUS_CHOICES = (
        ('Pending Payment', 'Pending Payment'), # New status
        ('Processing', 'Processing'),           # Paid and ready to pack
        ('Shipped', 'Shipped'),
        ('Delivered', 'Delivered'),
        ('Cancelled', 'Cancelled'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    shipping_address = models.TextField()
    
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending Payment')
    
    # NEW: For C2B Paybill reference
    mpesa_account_number = models.CharField(max_length=20, blank=True, null=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order #{self.id} - {self.full_name}"

    def save(self, *args, **kwargs):
        # Auto-generate Account Number (e.g., AFRO123) upon creation
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.mpesa_account_number:
            self.mpesa_account_number = f"AFRO{self.pk}"
            Order.objects.filter(pk=self.pk).update(mpesa_account_number=self.mpesa_account_number)

class PaymentTransaction(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    phone_number = models.CharField(max_length=20)
    checkout_request_id = models.CharField(max_length=100, unique=True)
    merchant_request_id = models.CharField(max_length=100)
    is_complete = models.BooleanField(default=False)
    mpesa_receipt_number = models.CharField(max_length=50, blank=True, null=True)
    result_description = models.TextField(blank=True, null=True)
    transaction_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment for Order #{self.order.id} ({self.checkout_request_id})"
    
class OrderItem(models.Model):
    """Stores individual products within an order. Captures the price AT THE TIME of purchase."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    quantity = models.PositiveIntegerField(default=1)
    
    # Why store price here? If the product price changes next month, this historical order record shouldn't change!
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2) 

    def __str__(self):
        return f"{self.quantity}x {self.product.name if self.product else 'Deleted Product'}"
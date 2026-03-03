# apps/store/api_views.py
import json
import logging
import base64
import uuid
from datetime import datetime
from django.utils import timezone
from django.http import JsonResponse
from decimal import Decimal
from django.views.decorators.csrf import csrf_exempt
from django.utils.timezone import make_aware
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from .models import Order, OrderItem, PaymentTransaction, Product, HeroBanner, RecentlyViewed
from .serializers import ProductSerializer, HeroBannerSerializer, CategorySerializer
from .models import Category
from rest_framework.permissions import AllowAny
from django.db import transaction
from rest_framework.permissions import IsAuthenticated
from .serializers import OrderSerializer
from .mpesa_utils import trigger_stk_push
from rest_framework.permissions import IsAdminUser
from django.core.files.base import ContentFile
from datetime import timedelta
from django.db.models import Sum, Count
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from xhtml2pdf import pisa
from io import BytesIO
from django.utils.text import slugify
User = get_user_model()
logger = logging.getLogger(__name__)


# Admin Views (for staff only)
# --- Utility Function ---
def decode_base64_file(data, name=None):
    """Converts a base64 string from Cropper.js into a Django ContentFile."""
    if 'data:' in data and ';base64,' in data:
        header, data = data.split(';base64,')
        # Extract extension from header (e.g., 'data:image/jpeg' -> 'jpeg')
        ext = header.split('/')[-1]
        if not name:
            name = f"{uuid.uuid4().hex}.{ext}"
        return ContentFile(base64.b64decode(data), name=name)
    return None

# --- Admin API View ---
@api_view(['POST'])
@permission_classes([IsAdminUser]) # Strictly lock this to admins
def admin_upload_image(request):
    """
    Receives a Base64 string, saves it, and returns the secure URL.
    This allows the admin to upload images dynamically before saving a product.
    """
    image_data = request.data.get('image_base64')
    
    if not image_data:
        return Response({"error": "No image data provided."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Decode the image
        file_obj = decode_base64_file(image_data)
        
        # For now, we will save this to a generic 'uploads' directory 
        # using Django's default storage system.
        from django.core.files.storage import default_storage
        file_path = default_storage.save(f"admin_uploads/{file_obj.name}", file_obj)
        file_url = default_storage.url(file_path)

        return Response({
            "message": "Image uploaded successfully",
            "url": file_url,
            "path": file_path  # <-- NEW: Return the relative path for the database
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_orders(request):
    """Fetches all orders, with optional status filtering."""
    status_filter = request.GET.get('status', '')
    orders = Order.objects.all().order_by('-created_at')
    
    if status_filter:
        orders = orders.filter(status=status_filter)
        
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)

@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_update_order_status(request, pk):
    """Instantly updates the status of a specific order."""
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    valid_statuses = dict(Order.STATUS_CHOICES).keys()

    if new_status in valid_statuses:
        order.status = new_status
        order.save()
        return Response({"message": "Order status updated successfully.", "status": order.status})
    
    return Response({"error": "Invalid status provided."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_check_or_create_user(request):
    """
    Step 1: Checks if user exists by email. 
    If not, checks if 'full_name' is provided to create new user.
    """
    email = request.data.get('email')
    full_name = request.data.get('full_name')
    phone = request.data.get('phone', '')

    if not email:
        return Response({"error": "Email required"}, status=400)

    # 1. Check existing
    try:
        user = User.objects.get(email=email)
        return Response({
            "status": "found",
            "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "phone": getattr(user, 'phone', '')}
        }, status=200)
    except User.DoesNotExist:
        # 2. If name provided, create new
        if full_name:
            # Set password to email for simplicity (Admin can reset later)
            user = User.objects.create_user(
                email=email, 
                username=email, # Using email as username
                password=email, 
                full_name=full_name,
                phone=phone
            )
            return Response({
                "status": "created",
                "user": {"id": user.id, "email": user.email, "full_name": user.full_name}
            }, status=201)
        
        # 3. Not found, request details
        return Response({"status": "not_found"}, status=404)

@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_create_manual_order(request):
    """Step 2: Creates order for the selected user with admin-selected items."""
    user_id = request.data.get('user_id')
    items_data = request.data.get('items', [])

    try:
        user = User.objects.get(id=user_id)
        
        # Calculate Total
        total_amount = 0
        for item in items_data:
            total_amount += (float(item['price']) * int(item['quantity']))

        # Create Order
        order = Order.objects.create(
            user=user,
            full_name=user.full_name,
            email=user.email,
            phone=getattr(user, 'phone', 'N/A'),
            shipping_address="Admin Manual Order", # Placeholder
            total_amount=total_amount,
            status='Pending Payment' # Default
        )

        # Create Items
        order_items = []
        for item in items_data:
            product = Product.objects.get(id=item['product_id'])
            order_items.append(OrderItem(
                order=order,
                product=product,
                quantity=item['quantity'],
                purchase_price=item['price']
            ))
        OrderItem.objects.bulk_create(order_items)

        return Response({"message": "Order created", "order_id": order.id}, status=201)

    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_order_detail(request, pk):
    """Handles updating customer details (PUT) and deleting an order (DELETE)."""
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PUT':
        # Using partial=True allows us to update only the fields provided
        from .serializers import OrderSerializer
        serializer = OrderSerializer(order, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Order updated successfully.", "order": serializer.data})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        order.delete()
        return Response({"message": "Order deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
    
def get_date_range(timeframe):
    """Helper function to calculate the start date based on timeframe."""
    now = timezone.now()
    if timeframe == 'daily':
        return now - timedelta(days=1)
    elif timeframe == 'weekly':
        return now - timedelta(days=7)
    elif timeframe == 'monthly':
        return now - timedelta(days=30)
    return now - timedelta(days=30) # Default to 30 days

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_analytics_data(request):
    """Calculates dashboard metrics and formats data for Chart.js."""
    timeframe = request.GET.get('timeframe', 'monthly')
    start_date = get_date_range(timeframe)
    
    # Base QuerySets
    orders = Order.objects.filter(created_at__gte=start_date)
    users = User.objects.filter(date_joined__gte=start_date)

    # 1. Top Metrics
    total_revenue = orders.exclude(status__in=['Pending Payment', 'Cancelled']).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
    total_orders = orders.count()
    new_users = users.count()

    # Get Top Product (Most sold item in this timeframe)
    from .models import OrderItem
    top_product_data = OrderItem.objects.filter(order__created_at__gte=start_date, order__status__in=['Processing', 'Shipped', 'Delivered']) \
        .values('product__name') \
        .annotate(total_sold=Sum('quantity')) \
        .order_by('-total_sold').first()
    top_product = top_product_data['product__name'] if top_product_data else "No Sales"

    # 2. Chart.js Data: Order Status Breakdown (Pie Chart)
    status_counts = orders.values('status').annotate(count=Count('id'))
    status_labels = []
    status_data = []
    for item in status_counts:
        status_labels.append(item['status'])
        status_data.append(item['count'])

    # 3. Chart.js Data: Revenue Over Time (Line Chart)
    # Grouping by date (simplistic grouping for SQLite/PostgreSQL compatibility)
    revenue_by_date = orders.exclude(status__in=['Pending Payment', 'Cancelled']) \
        .extra(select={'day': 'date(created_at)'}) \
        .values('day') \
        .annotate(daily_total=Sum('total_amount')) \
        .order_by('day')

    revenue_labels = [item['day'] for item in revenue_by_date]
    revenue_data = [item['daily_total'] for item in revenue_by_date]

    return Response({
        "metrics": {
            "revenue": total_revenue,
            "orders": total_orders,
            "users": new_users,
            "top_product": top_product
        },
        "charts": {
            "status_labels": status_labels,
            "status_data": status_data,
            "revenue_labels": revenue_labels,
            "revenue_data": revenue_data
        }
    })

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_export_pdf(request):
    """Generates a PDF report using xhtml2pdf based on the analytics data."""
    timeframe = request.GET.get('timeframe', 'monthly')
    start_date = get_date_range(timeframe)
    
    orders = Order.objects.filter(created_at__gte=start_date)
    total_revenue = orders.exclude(status__in=['Pending Payment', 'Cancelled']).aggregate(Sum('total_amount'))['total_amount__sum'] or 0

    # Render HTML template with context
    context = {
        'timeframe': timeframe.capitalize(),
        'date_generated': timezone.now(),
        'total_revenue': total_revenue,
        'total_orders': orders.count(),
        'new_users': User.objects.filter(date_joined__gte=start_date).count(),
        'recent_orders': orders.order_by('-created_at')[:15]
    }
    html_string = render_to_string('custom_admin/pdf_report.html', context)
    # Generate PDF via xhtml2pdf
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="Afrostreet_{timeframe}_Report.pdf"'
    
    pisa_status = pisa.CreatePDF(html_string, dest=response)
    
    if pisa_status.err:
        return Response({"error": "Failed to generate PDF"}, status=500)
        
    return response

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_manage_products(request):
    """Handles fetching all products (GET) and creating a new one (POST)."""
    if request.method == 'GET':
        products = Product.objects.all().order_by('-created_at')
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data.copy()
        if not data.get('slug'):
            data['slug'] = slugify(data.get('name', ''))
            
        serializer = ProductSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_product_detail(request, pk):
    """Handles updating (PUT) and deleting (DELETE) a specific product."""
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PUT':
        data = request.data.copy()
        if 'name' in data and not data.get('slug'):
            data['slug'] = slugify(data['name'])
            
        serializer = ProductSerializer(product, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        product.delete()
        return Response({"message": "Product deleted."}, status=status.HTTP_204_NO_CONTENT)

@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_manage_banners(request):
    if request.method == 'GET':
        # FIX: Changed '-created_at' to '-id'
        banners = HeroBanner.objects.all().order_by('-id')
        serializer = HeroBannerSerializer(banners, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = HeroBannerSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_delete_banner(request, pk):
    try:
        banner = HeroBanner.objects.get(pk=pk)
        banner.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except HeroBanner.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

# --- Promo Toggles API ---
@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_toggle_promotion(request, pk):
    """Instantly toggles the is_deal or is_offer flag on a product."""
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)

    promo_type = request.data.get('type') 
    new_status = request.data.get('status') 

    # FIX: Updated to match your exact model field names
    if promo_type == 'deal':
        product.is_deal = new_status
    elif promo_type == 'offer':
        product.is_offer = new_status
    else:
        return Response({"error": "Invalid promo type"}, status=status.HTTP_400_BAD_REQUEST)

    product.save()
    return Response({"message": "Promotion updated successfully"})

# Store apis==============================================
@api_view(['GET'])
@permission_classes([AllowAny])
def get_categories(request):
    """API endpoint to fetch all categories."""
    categories = Category.objects.all()
    serializer = CategorySerializer(categories, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_active_banners(request):
    """API endpoint to fetch all active hero banners for the frontend."""
    # FIX: Ensure we only show banners where the linked product is ALSO active
    banners = HeroBanner.objects.filter(is_active=True, product__is_active=True)
    serializer = HeroBannerSerializer(banners, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_products(request):
    """API endpoint to fetch products. Supports filtering by category slug."""
    category_slug = request.GET.get('category')
    
    if category_slug:
        products = Product.objects.filter(category__slug=category_slug, is_active=True)
    else:
        products = Product.objects.filter(is_active=True)
        
    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_deals_and_offers(request):
    """API endpoint to independently fetch products flagged as deals or offers."""
    deals = Product.objects.filter(is_deal=True, is_active=True)
    offers = Product.objects.filter(is_offer=True, is_active=True)
    
    return Response({
        'deals': ProductSerializer(deals, many=True).data,
        'offers': ProductSerializer(offers, many=True).data
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_product_detail(request, slug):
    """API endpoint to fetch a single product's details and track the view."""
    # FIX: Block access to direct links if the product is deactivated
    product = get_object_or_404(Product, slug=slug, is_active=True)
    
    if request.user.is_authenticated:
        RecentlyViewed.objects.update_or_create(
            user=request.user, 
            product=product
        )
    serializer = ProductSerializer(product)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_recently_viewed(request):
    """API endpoint to fetch the logged-in user's recently viewed products."""
    recent_history = RecentlyViewed.objects.filter(user=request.user, product__is_active=True).select_related('product')[:4]
    products = [history.product for history in recent_history]
    
    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_smart_related_products(request, slug):
    """SMART ALGORITHM: Fetches related products."""
    product = get_object_or_404(Product, slug=slug, is_active=True)
    
    same_category_products = Product.objects.filter(category=product.category, is_active=True).exclude(id=product.id)
    
    # FIX: Corrected the exclusion logic to properly filter active products in other categories
    other_products = Product.objects.filter(is_active=True).exclude(category=product.category).exclude(id=product.id)
    
    related_products = list(same_category_products) + list(other_products)
    related_products = related_products[:8]
    
    serializer = ProductSerializer(related_products, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

# NOTE: I noticed you had two process_checkout views in your snippet. 
# I assume this one handles the STK Push logic since it's more complete.
@api_view(['POST'])
@permission_classes([AllowAny])
def process_checkout(request):
    """Creates the order and immediately triggers an STK Push."""
    data = request.data
    customer_info = data.get('customer')
    cart_items = data.get('items')

    if not cart_items:
        return Response({"error": "Cart is empty"}, status=status.HTTP_400_BAD_REQUEST)

    phone_number = customer_info.get('phone')
    if not phone_number:
        return Response({"error": "Phone number is required for M-Pesa"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        total_amount = 0
        order = Order.objects.create(
            user=request.user if request.user.is_authenticated else None,
            full_name=customer_info.get('full_name'),
            email=customer_info.get('email'),
            phone=phone_number,
            shipping_address=customer_info.get('shipping_address'),
            total_amount=0,
            status='Pending Payment' 
        )

        order_items_to_create = []
        for item in cart_items:
            try:
                # FIX: Force the query to check if the product is STILL active at the moment of checkout
                product = Product.objects.get(id=item['id'], is_active=True)
                qty = int(item['quantity'])
                # Using discount price if available, otherwise regular price
                actual_price = product.discount_price if getattr(product, 'discount_price', None) else product.price
                
                total_amount += (actual_price * qty)
                order_items_to_create.append(OrderItem(order=order, product=product, quantity=qty, purchase_price=actual_price))
            
            except Product.DoesNotExist:
                # FIX: If a product was deactivated while in the user's cart, abort the whole checkout gracefully
                return Response({
                    "error": f"Item '{item.get('name', 'ID: '+str(item['id']))}' is currently out of stock or unavailable. Please remove it from your cart to proceed."
                }, status=status.HTTP_400_BAD_REQUEST)

        OrderItem.objects.bulk_create(order_items_to_create)
        order.total_amount = total_amount
        order.save()

    # --- Trigger M-Pesa STK Push ---
    try:
        checkout_id, merchant_id = trigger_stk_push(phone_number, total_amount, order)
        
        PaymentTransaction.objects.create(
            order=order,
            amount=total_amount,
            phone_number=phone_number,
            checkout_request_id=checkout_id,
            merchant_request_id=merchant_id,
            is_complete=False
        )
        
        return Response({
            "message": "Please check your phone to enter your M-Pesa PIN.", 
            "order_id": order.id,
            "account_number": order.mpesa_account_number, 
            "checkout_request_id": checkout_id
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"STK Push Failed: {e}")
        return Response({
            "error": "Order created, but M-Pesa STK push failed. Please pay via Paybill.",
            "order_id": order.id,
            "account_number": order.mpesa_account_number
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_orders(request):
    """API endpoint to fetch all orders for the logged-in user."""
    orders = Order.objects.filter(user=request.user).prefetch_related('items__product').order_by('-created_at')
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([AllowAny])
def process_checkout(request):
    """Creates the order and immediately triggers an STK Push."""
    data = request.data
    customer_info = data.get('customer')
    cart_items = data.get('items')

    if not cart_items:
        return Response({"error": "Cart is empty"}, status=status.HTTP_400_BAD_REQUEST)

    phone_number = customer_info.get('phone')
    if not phone_number:
        return Response({"error": "Phone number is required for M-Pesa"}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        total_amount = 0
        order = Order.objects.create(
            user=request.user if request.user.is_authenticated else None,
            full_name=customer_info.get('full_name'),
            email=customer_info.get('email'),
            phone=phone_number,
            shipping_address=customer_info.get('shipping_address'),
            total_amount=0,
            status='Pending Payment' # Order is created, but unpaid
        )

        order_items_to_create = []
        for item in cart_items:
            product = Product.objects.get(id=item['id'])
            qty = int(item['quantity'])
            actual_price = product.price
            total_amount += (actual_price * qty)
            order_items_to_create.append(OrderItem(order=order, product=product, quantity=qty, purchase_price=actual_price))

        OrderItem.objects.bulk_create(order_items_to_create)
        order.total_amount = total_amount
        order.save()

    # --- Trigger M-Pesa STK Push ---
    try:
        checkout_id, merchant_id = trigger_stk_push(phone_number, total_amount, order)
        
        # Log the pending transaction
        PaymentTransaction.objects.create(
            order=order,
            amount=total_amount,
            phone_number=phone_number,
            checkout_request_id=checkout_id,
            merchant_request_id=merchant_id,
            is_complete=False
        )
        
        return Response({
            "message": "Please check your phone to enter your M-Pesa PIN.", 
            "order_id": order.id,
            "account_number": order.mpesa_account_number, # <--- ADD THIS LINE
            "checkout_request_id": checkout_id
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"STK Push Failed: {e}")
        return Response({
            "error": "Order created, but M-Pesa STK push failed. Please pay via Paybill.",
            "order_id": order.id,
            "account_number": order.mpesa_account_number
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_payment_status(request, checkout_request_id):
    """Frontend polls this to check if user entered PIN successfully."""
    try:
        transaction = PaymentTransaction.objects.get(checkout_request_id=checkout_request_id)
        if transaction.is_complete:
            return Response({'status': 'COMPLETED'})
        return Response({'status': 'PENDING'})
    except PaymentTransaction.DoesNotExist:
        return Response({'status': 'NOT_FOUND'}, status=404)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def mpesa_callback(request):
    """Safaricom hits this URL when STK push succeeds or fails."""
    try:
        data = json.loads(request.body)
        callback = data.get('Body', {}).get('stkCallback', {})
        result_code = callback.get('ResultCode', 1)
        checkout_id = callback.get('CheckoutRequestID', '')

        tx = PaymentTransaction.objects.get(checkout_request_id=checkout_id)

        if result_code != 0:
            tx.is_complete = False
            tx.result_description = callback.get('ResultDesc', 'Failed')
            tx.save()
            return Response({'ResultCode': result_code, 'ResultDesc': 'Failed'})

        # Success - Parse Metadata
        items = callback.get('CallbackMetadata', {}).get('Item', [])
        for item in items:
            if item.get('Name') == 'MpesaReceiptNumber':
                tx.mpesa_receipt_number = item.get('Value')
            elif item.get('Name') == 'TransactionDate':
                try:
                    tx.transaction_date = make_aware(datetime.strptime(str(item.get('Value')), '%Y%m%d%H%M%S'))
                except:
                    pass

        tx.is_complete = True
        tx.save()

        # Update Order Status (Removed background tasks)
        order = tx.order
        order.status = 'Processing' 
        order.save()

        return Response({'ResultCode': 0, 'ResultDesc': 'Accepted'})

    except Exception as e:
        logger.error(f"STK Callback Error: {e}")
        return Response({'ResultCode': 1, 'ResultDesc': 'Error'}, status=400)
@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def c2b_validation(request):
    """
    Safaricom calls this to validate an STK or Paybill transaction before completion.
    """
    try:
        data = json.loads(request.body)
        bill_ref_number = data.get('BillRefNumber', '').strip().upper()
        trans_amount = data.get('TransAmount')

        # 1. Find the Order using the auto-generated account number
        order = Order.objects.get(mpesa_account_number=bill_ref_number)
        
        # 2. Check Amount
        paid_amount = Decimal(str(trans_amount))
        required_amount = order.total_amount
        
        if paid_amount < required_amount:
            return JsonResponse({
                "ResultCode": "C2B00013", 
                "ResultDesc": f"Rejected: Please pay the exact order amount of KSh {required_amount}."
            })
            
        # 3. Check if already paid or completed
        if order.status in ['Processing', 'Shipped', 'Delivered']:
             return JsonResponse({
                "ResultCode": "C2B00016", 
                "ResultDesc": "Rejected: This order has already been paid for."
            })

        # All checks passed, tell Safaricom to proceed!
        return JsonResponse({
            "ResultCode": "0", 
            "ResultDesc": "Accepted"
        })
        
    except Order.DoesNotExist:
        return JsonResponse({
            "ResultCode": "C2B00012", 
            "ResultDesc": "Rejected: Invalid Account Number. Please check your Afrostreet Order ID."
        })
    except Exception as e:
        logger.error(f"C2B Validation Error: {e}")
        return JsonResponse({
            "ResultCode": "C2B00016",
            "ResultDesc": "Rejected: System Validation Error."
        })


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def c2b_confirmation(request):
    """
    Safaricom calls this when a C2B transaction is COMPLETED successfully.
    """
    try:
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"ResultCode": "1", "ResultDesc": "Invalid JSON"}, status=400)

        # Safely extract and truncate fields to prevent database errors
        trans_id = str(data.get('TransID', '')).strip()[:20] 
        trans_amount = data.get('TransAmount')
        bill_ref_number = data.get('BillRefNumber', '').strip().upper()
        raw_msisdn = str(data.get('MSISDN', '')).strip()
        msisdn = raw_msisdn[:15] 
        trans_time = data.get('TransTime')

        if not trans_id:
            return JsonResponse({"ResultCode": "0", "ResultDesc": "Missing TransID"})

        # 1. Check for Duplicate Transaction (Prevent 500s on Safaricom retries)
        if PaymentTransaction.objects.filter(mpesa_receipt_number=trans_id).exists():
            return JsonResponse({"ResultCode": "0", "ResultDesc": "Transaction already processed"})

        # 2. Find the Order
        try:
            order = Order.objects.get(mpesa_account_number=bill_ref_number)
        except Order.DoesNotExist:
            logger.warning(f"C2B: Order not found for BillRef {bill_ref_number}")
            return JsonResponse({"ResultCode": "0", "ResultDesc": "Order not found"}) # Return 0 so Safaricom stops retrying

        # 3. Verify Amount & Parse Time
        try:
            paid_amount = Decimal(str(trans_amount)) if trans_amount else Decimal('0.00')
        except:
            paid_amount = Decimal('0.00')
            
        is_valid_amount = paid_amount >= order.total_amount

        aware_trans_time = timezone.now()
        if trans_time:
            try:
                aware_trans_time = make_aware(datetime.strptime(str(trans_time), '%Y%m%d%H%M%S'))
            except ValueError:
                pass 

        # 4. Create Transaction Record
        PaymentTransaction.objects.create(
            order=order,
            amount=paid_amount,
            phone_number=msisdn,
            mpesa_receipt_number=trans_id,
            checkout_request_id=trans_id, # Using TransID as a fallback for C2B where STK ID doesn't exist
            is_complete=True,
            transaction_date=aware_trans_time
        )

        # 5. Mark Order as Processing if the amount was sufficient
        if is_valid_amount:
            if order.status == 'Pending Payment':
                order.status = 'Processing'
                order.save()
                
                # OPTIONAL: You can add an email notification here later 
                # e.g., send_order_confirmation_email(order.user.email, order)
        else:
            logger.warning(f"C2B: Amount mismatch. Paid {paid_amount}, expected {order.total_amount}")

        return JsonResponse({"ResultCode": "0", "ResultDesc": "Processed Successfully"})

    except Exception as e:
        logger.exception("C2B Confirmation Critical Error")
        # Always return 0 to Safaricom on server errors to prevent endless retry loops
        return JsonResponse({"ResultCode": "0", "ResultDesc": "Error Handled Internally"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def register_urls_view(request):
    """
    Helper view for Admin/Staff to register Safaricom URLs manually.
    """
    if not request.user.is_staff:
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
    
    from .mpesa_utils import register_c2b_urls
    response = register_c2b_urls()
    return Response(response)


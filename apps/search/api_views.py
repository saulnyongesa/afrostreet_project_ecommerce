# apps/search/api_views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q

from .models import SearchQuery
from .serializers import SearchQuerySerializer

# Import Product and its serializer from the store app
from apps.store.models import Product
from apps.store.serializers import ProductSerializer

@api_view(['GET'])
@permission_classes([AllowAny])
def search_autocomplete(request):
    """
    API endpoint for real-time auto-suggestions.
    Returns up to 5 successful past search queries that match the typed input.
    """
    query = request.GET.get('q', '').strip().lower()
    
    if not query:
        return Response([], status=status.HTTP_200_OK)
    
    # Fetch top 5 past queries that contain the typed text, 
    # automatically ordered by frequency (highest first) due to our model's Meta ordering
    suggestions = SearchQuery.objects.filter(query_text__icontains=query)[:5]
    serializer = SearchQuerySerializer(suggestions, many=True)
    
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def execute_search(request):
    """
    API endpoint to search for products.
    If products are found, it logs the successful query to power future auto-suggestions.
    """
    query = request.GET.get('q', '').strip().lower()
    
    if not query:
        return Response([], status=status.HTTP_200_OK)

    # Search for products where the name or description contains the query
    products = Product.objects.filter(
        Q(name__icontains=query) | Q(description__icontains=query)
    ).distinct()

    # SMART TRACKING: Only log the query if it actually returned products
    if products.exists():
        search_obj, created = SearchQuery.objects.get_or_create(query_text=query)
        if not created:
            # If it already exists, just increase its popularity score
            search_obj.frequency += 1
            search_obj.save()

    # Reuse our ProductSerializer to return the matched items
    serializer = ProductSerializer(products, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)
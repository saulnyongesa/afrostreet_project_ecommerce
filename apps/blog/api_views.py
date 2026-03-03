# apps/blog/api_views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from .models import Article
from .serializers import ArticleSerializer
from django.utils.text import slugify

@api_view(['GET'])
@permission_classes([AllowAny])
def get_published_articles(request):
    """
    API endpoint to fetch all published blog articles.
    Uses select_related to optimize the database query and prevent N+1 issues when fetching the author.
    """
    articles = Article.objects.filter(is_published=True).select_related('author')
    serializer = ArticleSerializer(articles, many=True)
    
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_article_detail(request, slug):
    """
    API endpoint to fetch a single blog article by its unique slug.
    """
    try:
        # Ensure we only fetch articles that are explicitly published
        article = Article.objects.select_related('author').get(slug=slug, is_published=True)
    except Article.DoesNotExist:
        return Response(
            {"error": "Article not found or is not published."}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    serializer = ArticleSerializer(article)
    return Response(serializer.data, status=status.HTTP_200_OK)
# Admin API Views (for future use)
@api_view(['GET', 'POST'])
@permission_classes([IsAdminUser])
def admin_manage_articles(request):
    """Handles fetching all articles (GET) and creating a new one (POST)."""
    if request.method == 'GET':
        articles = Article.objects.all().order_by('-created_at')
        serializer = ArticleSerializer(articles, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data
        # Auto-generate slug if not provided
        if not data.get('slug'):
            data['slug'] = slugify(data.get('title', ''))
            
        # Ensure the author is set to the current admin
        serializer = ArticleSerializer(data=data)
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def admin_article_detail(request, pk):
    """Handles updating (PUT) and deleting (DELETE) a specific article."""
    try:
        article = Article.objects.get(pk=pk)
    except Article.DoesNotExist:
        return Response({"error": "Article not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PUT':
        data = request.data
        if 'title' in data and not data.get('slug'):
            data['slug'] = slugify(data['title'])
            
        serializer = ArticleSerializer(article, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        article.delete()
        return Response({"message": "Article deleted."}, status=status.HTTP_204_NO_CONTENT)
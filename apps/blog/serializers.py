# apps/blog/serializers.py
from rest_framework import serializers
from .models import Article

class ArticleSerializer(serializers.ModelSerializer):
    # OVERRIDE: Tell DRF to accept our pre-uploaded string path instead of demanding a file
    cover_image = serializers.CharField(max_length=500, required=True)

    class Meta:
        model = Article
        fields = '__all__'
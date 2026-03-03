# apps/blog/models.py
from django.db import models
from django.conf import settings
from django_ckeditor_5.fields import CKEditor5Field as RichTextField

class Article(models.Model):
    """Blog posts for fashion, tutorials, and modeling events."""
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    cover_image = models.ImageField(upload_to='blog_covers/')
    content = RichTextField() # CKEditor integration
    created_at = models.DateTimeField(auto_now_add=True)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
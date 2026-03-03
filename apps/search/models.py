# apps/search/models.py
from django.db import models

class SearchQuery(models.Model):
    """Stores successful search queries for future auto-suggestions."""
    query_text = models.CharField(max_length=255, unique=True)
    frequency = models.PositiveIntegerField(default=1, help_text="How often this query led to a match")
    last_searched = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-frequency', '-last_searched']

    def __str__(self):
        return f"{self.query_text} ({self.frequency})"
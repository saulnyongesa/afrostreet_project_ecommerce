# apps/blog/views.py
from django.shortcuts import render

def blog_list_page(request):
    return render(request, 'blog/blog_list.html')

def blog_detail_page(request, slug):
    return render(request, 'blog/blog_detail.html', {'slug': slug})
# apps/store/views.py
from django.shortcuts import render
from django.contrib.auth.decorators import login_required

def home_page(request):
    """
    Renders the main landing page shell. 
    Actual data (banners, deals, products) is fetched via Vanilla JS hitting our API endpoints.
    """
    return render(request, 'store/home.html')

def product_detail_page(request, slug):
    """Renders the product detail shell. JS will fetch the data using the slug."""
    # We pass the slug to the template context so our JS knows which product to fetch
    return render(request, 'store/product_detail.html', {'slug': slug})

def category_detail_page(request, slug):
    """Renders the category detail shell. JS will fetch the data using the slug."""
    return render(request, 'store/category_detail.html', {'slug': slug})

@login_required(login_url='/')
def checkout_page(request):
    """Renders the checkout shell. JS will populate the order summary from localStorage."""
    return render(request, 'store/checkout.html')

@login_required(login_url='/') # Kick unauthenticated users back to home
def my_orders_page(request):
    """Renders the user dashboard shell."""
    return render(request, 'store/my_orders.html')


def promotions_page(request, promo_type):
    """
    Renders the page for either 'deals' or 'offers'. 
    Redirects home if an invalid type is typed in the URL.
    """
    if promo_type not in ['deals', 'offers']:
        from django.shortcuts import redirect
        return redirect('home')
        
    return render(request, 'store/promotions.html', {'promo_type': promo_type})

# apps/accounts/api_views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, login, logout
from .serializers import UserRegistrationSerializer

@api_view(['POST'])
@permission_classes([AllowAny])
def ajax_register(request):
    """API endpoint for seamless user registration."""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        # Automatically log the user in after successful registration
        login(request, user)
        return Response({
            "message": "Account created successfully.",
            "user": {"email": user.email, "full_name": user.full_name}
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def ajax_login(request):
    """API endpoint for seamless AJAX login."""
    email = request.data.get('email')
    password = request.data.get('password')

    user = authenticate(request, email=email, password=password)
    
    if user is not None:
        login(request, user)
        return Response({
            "message": "Login successful.",
            "user": {"email": user.email, "full_name": user.full_name}
        }, status=status.HTTP_200_OK)
    else:
        return Response(
            {"error": "Invalid email or password."}, 
            status=status.HTTP_401_UNAUTHORIZED
        )

@api_view(['POST'])
def ajax_logout(request):
    """API endpoint for logging out."""
    logout(request)
    return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
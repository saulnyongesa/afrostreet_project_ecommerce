# apps/store/mpesa_utils.py
import requests
import json
import base64
from requests.auth import HTTPBasicAuth
from datetime import datetime
from django.conf import settings

class MpesaC2bCredential:
    consumer_key = settings.CONSUMER_KEY
    consumer_secret = settings.CONSUMER_SECRET
    api_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    # Updated to Afrostreet domain
    call_back_url = 'https://www.afrostreet.com/api/store/mpesa/callback/'
    request_api_url = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"

class MpesaAccessToken:
    @staticmethod
    def get_access_token():
        try:
            r = requests.get(MpesaC2bCredential.api_URL,
                             auth=HTTPBasicAuth(MpesaC2bCredential.consumer_key, MpesaC2bCredential.consumer_secret),
                             timeout=10)
            r.raise_for_status()
            mpesa_access_token = json.loads(r.text)
            return mpesa_access_token["access_token"]
        except requests.exceptions.RequestException as e:
            print(f"Error fetching M-Pesa access token: {e}")
            raise

class LipanaMpesaPassword:
    @staticmethod
    def get_password():
        lipa_time = datetime.now().strftime('%Y%m%d%H%M%S')
        Business_short_code = settings.BUSINESS_SHORT_CODE
        passkey = settings.PASSKEY
        data_to_encode = Business_short_code + passkey + lipa_time
        online_password = base64.b64encode(data_to_encode.encode())
        return online_password.decode('utf-8'), lipa_time, Business_short_code

def trigger_stk_push(phone_number, amount, order):
    """Triggers an STK push to the customer's phone for an Afrostreet Order."""
    if phone_number.startswith('+'):
        phone_number = phone_number[1:]
    if phone_number.startswith('0'):
        phone_number = '254' + phone_number[1:]

    access_token = MpesaAccessToken.get_access_token()
    password, timestamp, shortcode = LipanaMpesaPassword.get_password()
    headers = {"Authorization": f"Bearer {access_token}"}

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(float(amount)),
        "PartyA": phone_number,
        "PartyB": shortcode,
        "PhoneNumber": phone_number,
        "CallBackURL": MpesaC2bCredential.call_back_url,
        "AccountReference": str(order.mpesa_account_number),
        "TransactionDesc": f"Afrostreet Order {order.id}"
    }

    response = requests.post(MpesaC2bCredential.request_api_url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    resp_json = response.json()
    
    return resp_json.get('CheckoutRequestID'), resp_json.get('MerchantRequestID')

def register_c2b_urls():
    """Registers Validation and Confirmation URLs for manual Paybill payments."""
    access_token = MpesaAccessToken.get_access_token()
    url = "https://api.safaricom.co.ke/mpesa/c2b/v2/registerurl"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    domain = "https://www.afrostreet.com"
    payload = {
        "ShortCode": settings.BUSINESS_SHORT_CODE,
        "ResponseType": "Cancelled", 
        "ConfirmationURL": f"{domain}/api/store/c2b/confirmation/",
        "ValidationURL": f"{domain}/api/store/c2b/validation/"
    }

    response = requests.post(url, json=payload, headers=headers)
    return response.json()
import pytest
import requests
import os

@pytest.fixture(scope="session")
def base_url():
    """Get backend URL from environment"""
    url = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    if not url:
        raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not set in environment")
    return url.rstrip('/')

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="session")
def owner_token(base_url, api_client):
    """Login as owner and return token"""
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "owner@spicekitchen.com", "password": "demo123"}
    )
    assert response.status_code == 200, f"Owner login failed: {response.text}"
    data = response.json()
    return data["token"]

@pytest.fixture(scope="session")
def manager_token(base_url, api_client):
    """Login as manager and return token"""
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "manager@spicekitchen.com", "password": "demo123"}
    )
    assert response.status_code == 200, f"Manager login failed: {response.text}"
    data = response.json()
    return data["token"]

@pytest.fixture(scope="session")
def staff_token(base_url, api_client):
    """Login as staff and return token"""
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "staff@spicekitchen.com", "password": "demo123"}
    )
    assert response.status_code == 200, f"Staff login failed: {response.text}"
    data = response.json()
    return data["token"]

@pytest.fixture(scope="session")
def accounts_token(base_url, api_client):
    """Login as accounts and return token"""
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": "accounts@spicekitchen.com", "password": "demo123"}
    )
    assert response.status_code == 200, f"Accounts login failed: {response.text}"
    data = response.json()
    return data["token"]

@pytest.fixture
def auth_headers_owner(owner_token):
    """Headers with owner auth token"""
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}

@pytest.fixture
def auth_headers_manager(manager_token):
    """Headers with manager auth token"""
    return {"Authorization": f"Bearer {manager_token}", "Content-Type": "application/json"}

@pytest.fixture
def auth_headers_staff(staff_token):
    """Headers with staff auth token"""
    return {"Authorization": f"Bearer {staff_token}", "Content-Type": "application/json"}

@pytest.fixture
def auth_headers_accounts(accounts_token):
    """Headers with accounts auth token"""
    return {"Authorization": f"Bearer {accounts_token}", "Content-Type": "application/json"}

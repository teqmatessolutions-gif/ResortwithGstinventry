#!/usr/bin/env python3
"""Test script for Resort Management API"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8011"

def print_test(name, status, message=""):
    """Print test result"""
    status_symbol = "✓" if status else "✗"
    status_color = "PASSED" if status else "FAILED"
    print(f"{status_symbol} {name}: {status_color}")
    if message:
        print(f"  {message}")

def test_health():
    """Test health endpoint"""
    print("\n1. Testing Health Endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print_test("Health Check", True, f"Response: {json.dumps(data)}")
            return True
        else:
            print_test("Health Check", False, f"Status: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_test("Health Check", False, "Connection refused - Server not running")
        return False
    except Exception as e:
        print_test("Health Check", False, f"Error: {str(e)}")
        return False

def test_services():
    """Test services API"""
    print("\n2. Testing Services API...")
    try:
        response = requests.get(f"{BASE_URL}/api/services?limit=5", timeout=5)
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 0
            print_test("Services API", True, f"Found {count} services")
            if count > 0:
                service = data[0]
                print(f"  First service: {service.get('name')} - Charges: {service.get('charges')}")
                print(f"  Has images: {len(service.get('images', []))}")
                print(f"  Has inventory items: {len(service.get('inventory_items', []))}")
            else:
                print("  (No services in database)")
            return True
        else:
            print_test("Services API", False, f"Status: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except requests.exceptions.ConnectionError:
        print_test("Services API", False, "Connection refused - Server not running")
        return False
    except Exception as e:
        print_test("Services API", False, f"Error: {str(e)}")
        return False

def test_assigned_services():
    """Test assigned services API"""
    print("\n3. Testing Assigned Services API...")
    try:
        response = requests.get(f"{BASE_URL}/api/services/assigned?skip=0&limit=5", timeout=5)
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else 0
            print_test("Assigned Services API", True, f"Found {count} assigned services")
            return True
        else:
            print_test("Assigned Services API", False, f"Status: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_test("Assigned Services API", False, "Connection refused - Server not running")
        return False
    except Exception as e:
        print_test("Assigned Services API", False, f"Error: {str(e)}")
        return False

def main():
    print("=" * 50)
    print("Testing Resort Management API")
    print("=" * 50)
    
    results = []
    results.append(("Health Check", test_health()))
    results.append(("Services API", test_services()))
    results.append(("Assigned Services API", test_assigned_services()))
    
    print("\n" + "=" * 50)
    print("Test Summary")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "PASSED" if result else "FAILED"
        print(f"{name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✓ All tests passed!")
        return 0
    else:
        print("\n✗ Some tests failed. Make sure the server is running.")
        print("  Start backend: cd ResortApp && python main.py")
        return 1

if __name__ == "__main__":
    sys.exit(main())



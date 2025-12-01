import requests
import json

BASE_URL = "http://localhost:8011/api"

def test_status_update():
    # 1. Get all assigned services
    response = requests.get(f"{BASE_URL}/services/assigned")
    if response.status_code != 200:
        print(f"Failed to get assigned services: {response.text}")
        return

    assigned_services = response.json()
    if not assigned_services:
        print("No assigned services found.")
        return

    # Pick the first one
    target = assigned_services[0]
    target_id = target['id']
    current_status = target['status']
    
    print(f"Target Assigned Service ID: {target_id}, Current Status: {current_status}")

    # Determine new status
    new_status = "in_progress" if current_status == "pending" else "completed"
    if current_status == "completed":
        new_status = "pending"

    print(f"Attempting to update status to: {new_status}")

    # 2. Update status
    update_payload = {"status": new_status}
    response = requests.patch(f"{BASE_URL}/services/assigned/{target_id}", json=update_payload)
    
    if response.status_code != 200:
        print(f"Failed to update status: {response.text}")
        return

    updated_service = response.json()
    print(f"Update Response Status: {updated_service['status']}")

    if updated_service['status'] == new_status:
        print("SUCCESS: Status updated correctly.")
    else:
        print(f"FAILURE: Status did not update. Expected {new_status}, got {updated_service['status']}")

if __name__ == "__main__":
    test_status_update()

#!/usr/bin/env python3
import sys
import requests
import os

FASTAPI_SERVER = os.getenv("ENTRAID_FASTAPI_SERVER", "http://wsutm.bluepex.com:30001")


def main():
    if len(sys.argv) != 3:
        print("Usage: verify_saml.py <username> <short_id>")
        sys.exit(1)

    username, short_id = sys.argv[1], sys.argv[2]
    try:
        resp = requests.get(f"{FASTAPI_SERVER}/validate/{short_id}", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("username") == username:
                sys.exit(0)  # Allow
        sys.exit(1)  # Deny if not matched
    except Exception as e:
        print(f"Error verifying short_id: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

import pickle
import sys
import json
import os

pkl_path = r'd:\Project\DigitalAssetManagment\trained_llm_model.pkl'

print(f"File size: {os.path.getsize(pkl_path) / 1024:.1f} KB")

try:
    with open(pkl_path, 'rb') as f:
        data = pickle.load(f)

    print(f"\nTop-level type: {type(data).__name__}")

    if isinstance(data, dict):
        print(f"Keys ({len(data.keys())}): {list(data.keys())}")
        for k, v in list(data.items())[:10]:
            if isinstance(v, (list, dict)):
                print(f"  [{k}] ({type(v).__name__}, len={len(v)}): {str(v)[:150]}")
            else:
                print(f"  [{k}] ({type(v).__name__}): {str(v)[:150]}")

    elif isinstance(data, list):
        print(f"List length: {len(data)}")
        print(f"Item type: {type(data[0]).__name__}")
        for i, item in enumerate(data[:3]):
            print(f"\n  Item[{i}]: {str(item)[:300]}")

    elif hasattr(data, '__class__'):
        print(f"Class: {data.__class__.__name__}")
        print(f"Module: {data.__class__.__module__}")
        if hasattr(data, '__dict__'):
            print(f"Attributes: {list(data.__dict__.keys())}")
            for k, v in list(data.__dict__.items())[:5]:
                print(f"  {k}: {str(v)[:200]}")

    else:
        print(f"Value: {str(data)[:500]}")

except Exception as e:
    print(f"Error loading with pickle: {e}")
    # Try loading with specific protocols
    for proto in [0, 1, 2, 3, 4, 5]:
        try:
            import pickletools
            with open(pkl_path, 'rb') as f:
                data = pickle.load(f)
            print(f"Loaded with protocol {proto}")
            break
        except Exception as e2:
            print(f"Protocol {proto} failed: {e2}")

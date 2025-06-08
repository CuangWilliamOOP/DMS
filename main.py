from backend.documents.gpt_parser import gpt_parse_subsections_from_image
import json
import os

def test_gpt_parser(image_path):
    print(f"Testing GPT Parser with image: {image_path}")
    parsed_result = gpt_parse_subsections_from_image(image_path)
    print("Parsed Result:")
    print(json.dumps(parsed_result, indent=2))

if __name__ == "__main__":
    image_path = r"C:\Users\alung\Downloads\testtt.png"

    test_gpt_parser(image_path)
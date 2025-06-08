import base64
import json
import re
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()  

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)
def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def extract_json_from_markdown(markdown_str):
    # Extract JSON from markdown-style code block
    json_match = re.search(r'```json\s*(.*?)\s*```', markdown_str, re.DOTALL)
    if json_match:
        return json_match.group(1).strip()
    else:
        # Fallback, clean manually if no markdown detected
        return markdown_str.strip("`json\n ").replace("```", "").strip()

def gpt_parse_subsections_from_image(image_path: str):
    b64_image = encode_image(image_path)

    prompt = """
    You are an AI assistant that extracts table data from an invoice or financial document image.

    The image contains multiple sections, each titled with 'PT. ...' (e.g., PT. GIN, PT. BPS, PT. BAT & ALS). 
    Under each section is a table with the following columns: 

        1. "No"
        2. "KETERANGAN"
        3. "DIBAYAR KE"
        4. "BANK"
        5. "PENGIRIMAN"

    Note: 1.  that it does not have
    to be explicitly PT.GIN, PT.BPS etc. This is just an example. The title could very well be things like "Sparepart",
    "Penggantian Kas Kecil Kantor", etc. 

    For each section:
      - Save the table as a 2D array of rows, 
        where row 0 is the header: ["No", "KETERANGAN", "DIBAYAR KE", "BANK", "PENGIRIMAN"].
      - Then each subsequent row has the data from that row.
      - Extract the SUBTOTAL if it appears (e.g., 768.833.600).
      - The main 'company' field is the PT. name, e.g. "PT. GIN", "PT. BPS", or "PT. BAT & ALS".
    If there's a final GRAND TOTAL at the bottom (e.g. "TOTAL CEK YANG MAU DIBUKA = 878.826.600"),
    place it in a separate object with "grand_total": <value>.

    Note: 2. If the document is in pdf format, stop extracting data once the value of "Total cek yang mau dibuka" is encountered.

    Return strictly valid JSON with no extra text, in this exact structure:
    [
      {
        "company": "PT. GIN",
        "table": [
          ["No", "KETERANGAN", "DIBAYAR KE", "BANK", "PENGIRIMAN"],
          ["1", "Pelunasan ...", "Doni Iskandar", "BRI", "635.333.600"],
          ["2", "Permintaan ...", "", "", "133.500.000"]
        ],
        "subtotal": "768.833.600"
      },
      {
        "company": "PT. BPS",
        "table": [...],
        "subtotal": "6.142.000"
      },
      {
        "company": "PT. BAT & ALS",
        "table": [...],
        "subtotal": "103.851.000"
      },
      {
        "grand_total": "878.826.600"
      }
    ]

    Only return the JSON. Do NOT include any explanations, disclaimers, or markdown formatting.
    """

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}",
                            "detail": "auto"
                        }
                    }
                ]
            }
        ],
        max_tokens=1200,
        temperature=0.0
    )

    # Corrected the extraction of the response content here
    gpt_response = response.choices[0].message.content.strip()

    # Use markdown extraction function
    cleaned_json_str = extract_json_from_markdown(gpt_response)

    try:
        parsed_result = json.loads(cleaned_json_str)
    except json.JSONDecodeError as e:
        print("JSON decoding error:", e)
        parsed_result = []

    return parsed_result

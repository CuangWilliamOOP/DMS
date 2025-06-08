# /mnt/data/documents/ocr_service.py

import pytesseract
from PIL import Image
import os
import subprocess
import tempfile

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def extract_text_from_image(image_path: str) -> str:
    """
    Extract text from a single image using Tesseract OCR.
    :param image_path: path to the image file (PNG, JPG, etc.)
    :return: extracted text as a string
    """
    text = pytesseract.image_to_string(Image.open(image_path), lang='eng')
    return text

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extract text from a PDF by converting each page to an image, then applying OCR.
    :param pdf_path: path to the PDF file
    :return: combined text from all pages
    """
    # We'll need to convert PDF to images first.
    # One approach is to use `pdftoppm` (part of poppler-utils) or wand library.
    # Below is an example with pdftoppm command-line usage.

    text_accumulated = []
    with tempfile.TemporaryDirectory() as temp_dir:
        # Convert PDF to a series of page images (e.g. out-1.png, out-2.png, etc.)
        # -r 150 => 150 DPI; adjust as needed for better accuracy
        cmd = [
            'pdftoppm',
            '-r', '150',
            '-png',
            pdf_path,
            os.path.join(temp_dir, 'page')
        ]
        subprocess.run(cmd, check=True)

        # Now loop over generated images
        for file_name in sorted(os.listdir(temp_dir)):
            if file_name.endswith('.png'):
                image_path = os.path.join(temp_dir, file_name)
                page_text = extract_text_from_image(image_path)
                text_accumulated.append(page_text)

    return "\n".join(text_accumulated)

def extract_text(file_path: str) -> str:
    """
    Main entry point for extracting text from a file.
    Detect if it's an image or a PDF, then call the appropriate function.
    :param file_path: path to the uploaded file
    :return: extracted text
    """
    _, ext = os.path.splitext(file_path.lower())

    if ext in ['.png', '.jpg', '.jpeg']:
        return extract_text_from_image(file_path)
    elif ext == '.pdf':
        return extract_text_from_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file format for OCR: {ext}")

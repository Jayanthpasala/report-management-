"""
Document Processing Adapter Pattern
Pluggable interface for document AI extraction.

Processors:
  - GPT4oProcessor: Real AI using OpenAI GPT-4o via Emergent LLM key
  - DocumentAIProcessor: Stub for Google Document AI (future)
  - MockProcessor: Deterministic mock for testing

All processors implement the same interface and return standardized ExtractionResult.
"""

import os
import json
import uuid
import base64
import logging
import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass, field, asdict
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

logger = logging.getLogger(__name__)

# ---- Data Models ----

@dataclass
class LineItem:
    description: str = ""
    quantity: float = 0
    unit_price: float = 0
    amount: float = 0
    category: str = ""

@dataclass
class ExtractionResult:
    document_type: str = "unknown"
    supplier_name: str = ""
    supplier_gst: str = ""
    invoice_number: str = ""
    document_date: Optional[str] = None
    document_date_confidence: float = 0.0
    line_items: list = field(default_factory=list)
    subtotal: float = 0.0
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    currency: str = "INR"
    extraction_confidence: float = 0.0
    extraction_method: str = ""
    ai_provider_used: str = ""
    raw_ocr_text: str = ""
    raw_json_output: str = ""
    error: Optional[str] = None
    retries_used: int = 0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["line_items"] = [asdict(li) if hasattr(li, '__dataclass_fields__') else li for li in self.line_items]
        return d


# ---- Abstract Processor ----

class DocumentProcessor(ABC):
    """Common interface for all document processors."""

    @abstractmethod
    async def extract(self, file_content: bytes, filename: str, mime_type: str) -> ExtractionResult:
        """Extract structured data from a document file."""
        pass

    @abstractmethod
    def name(self) -> str:
        pass


# ---- GPT-4o Processor (Real AI) ----

EXTRACTION_SYSTEM_PROMPT = """You are a financial document AI that extracts structured data from invoices, bills, receipts, and statements.

ALWAYS return valid JSON with this exact structure:
{
  "document_type": "purchase_invoice" | "sales_receipt" | "aggregator_statement" | "expense_bill" | "utility_bill",
  "supplier_name": "string",
  "supplier_gst": "string or empty",
  "invoice_number": "string or empty",
  "document_date": "YYYY-MM-DD or null if not found",
  "document_date_confidence": 0.0-1.0,
  "line_items": [{"description": "string", "quantity": number, "unit_price": number, "amount": number, "category": "string"}],
  "subtotal": number,
  "tax_rate": number (decimal, e.g. 0.18 for 18%),
  "tax_amount": number,
  "total_amount": number,
  "currency": "INR" | "USD" | "AED" | "GBP" | "EUR",
  "extraction_confidence": 0.0-1.0,
  "raw_ocr_text": "full text visible in the document"
}

Rules:
- document_date MUST be the invoice/bill date, NOT today's date
- If multiple dates exist, prefer the invoice date over due date
- If date is unclear, set document_date to null and confidence to 0
- extraction_confidence should reflect how clearly you can read the document
- For blurry/rotated images, lower the confidence accordingly
- Include ALL line items you can identify
- Currency should match what's on the document
- raw_ocr_text should contain all readable text from the document"""


class GPT4oProcessor(DocumentProcessor):
    """Real AI processor using OpenAI GPT-4o via Emergent LLM key."""

    def __init__(self, max_retries: int = 2):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        self.max_retries = max_retries

    def name(self) -> str:
        return "gpt4o"

    async def extract(self, file_content: bytes, filename: str, mime_type: str) -> ExtractionResult:
        if not self.api_key:
            logger.error("EMERGENT_LLM_KEY not set")
            return ExtractionResult(error="API key not configured", ai_provider_used="gpt4o")

        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

        # Encode image to base64
        b64_content = base64.b64encode(file_content).decode('utf-8')

        for attempt in range(self.max_retries + 1):
            try:
                session_id = f"doc-extract-{uuid.uuid4().hex[:8]}"
                chat = LlmChat(
                    api_key=self.api_key,
                    session_id=session_id,
                    system_message=EXTRACTION_SYSTEM_PROMPT
                ).with_model("openai", "gpt-4o")

                image_content = ImageContent(image_base64=b64_content)

                user_msg = UserMessage(
                    text=f"Extract all financial data from this document image. Filename: {filename}. Return ONLY valid JSON.",
                    file_contents=[image_content]
                )

                response = await chat.send_message(user_msg)
                logger.info(f"GPT-4o response received for {filename} (attempt {attempt + 1})")

                # Parse JSON from response
                result = self._parse_response(response, attempt)
                result.ai_provider_used = "gpt4o"
                result.extraction_method = "gpt4o_vision"
                result.retries_used = attempt
                return result

            except Exception as e:
                logger.warning(f"GPT-4o extraction attempt {attempt + 1} failed: {e}")
                if attempt == self.max_retries:
                    return ExtractionResult(
                        error=f"All {self.max_retries + 1} attempts failed: {str(e)}",
                        ai_provider_used="gpt4o",
                        extraction_method="gpt4o_vision",
                        retries_used=attempt + 1,
                    )
                await asyncio.sleep(1)  # Brief pause before retry

        return ExtractionResult(error="Unexpected flow", ai_provider_used="gpt4o")

    def _parse_response(self, response: str, attempt: int) -> ExtractionResult:
        """Parse GPT-4o response into ExtractionResult."""
        # Extract JSON from response (may be wrapped in markdown code block)
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse JSON response, attempt {attempt + 1}")
            return ExtractionResult(
                error="JSON parse failure",
                raw_ocr_text=response[:2000],
                extraction_confidence=0.2,
            )

        line_items = []
        for item in data.get("line_items", []):
            line_items.append({
                "description": item.get("description", ""),
                "quantity": float(item.get("quantity", 0)),
                "unit_price": float(item.get("unit_price", 0)),
                "amount": float(item.get("amount", 0)),
                "category": item.get("category", ""),
            })

        return ExtractionResult(
            document_type=data.get("document_type", "unknown"),
            supplier_name=data.get("supplier_name", ""),
            supplier_gst=data.get("supplier_gst", ""),
            invoice_number=data.get("invoice_number", ""),
            document_date=data.get("document_date"),
            document_date_confidence=float(data.get("document_date_confidence", 0)),
            line_items=line_items,
            subtotal=float(data.get("subtotal", 0)),
            tax_rate=float(data.get("tax_rate", 0)),
            tax_amount=float(data.get("tax_amount", 0)),
            total_amount=float(data.get("total_amount", 0)),
            currency=data.get("currency", "INR"),
            extraction_confidence=float(data.get("extraction_confidence", 0.5)),
            raw_ocr_text=data.get("raw_ocr_text", ""),
            raw_json_output=json_str[:5000],
        )


# ---- Google Document AI Processor (Stub) ----

class DocumentAIProcessor(DocumentProcessor):
    """Stub for future Google Document AI integration."""

    def name(self) -> str:
        return "document_ai"

    async def extract(self, file_content: bytes, filename: str, mime_type: str) -> ExtractionResult:
        # TODO: Implement real Document AI integration
        # from google.cloud import documentai_v1
        # client = documentai_v1.DocumentProcessorServiceClient()
        # ...
        raise NotImplementedError(
            "Google Document AI not yet configured. "
            "Set GOOGLE_APPLICATION_CREDENTIALS and DOCUMENT_AI_PROCESSOR_ID."
        )


# ---- Mock Processor (Testing) ----

class MockProcessor(DocumentProcessor):
    """Mock processor for testing. Uses the original ai_pipeline.py logic."""

    def name(self) -> str:
        return "mock"

    async def extract(self, file_content: bytes, filename: str, mime_type: str) -> ExtractionResult:
        from ai_pipeline import extract_document_data
        data = extract_document_data(filename, len(file_content))
        return ExtractionResult(
            document_type=data.get("document_type", "unknown"),
            supplier_name=data.get("supplier_name", ""),
            supplier_gst=data.get("supplier_gst", ""),
            invoice_number=data.get("invoice_number", ""),
            document_date=data.get("document_date"),
            document_date_confidence=data.get("document_date_confidence", 0),
            line_items=data.get("line_items", []),
            subtotal=data.get("subtotal", 0),
            tax_rate=data.get("tax_rate", 0),
            tax_amount=data.get("tax_amount", 0),
            total_amount=data.get("total_amount", 0),
            currency=data.get("currency", "INR"),
            extraction_confidence=data.get("extraction_confidence", 0.5),
            extraction_method=data.get("extraction_method", "mock"),
            ai_provider_used="mock",
            raw_ocr_text=data.get("raw_text_snippet", ""),
        )


# ---- Factory ----

def get_processor(provider: str = None) -> DocumentProcessor:
    """Get the configured document processor."""
    if provider is None:
        provider = os.environ.get("DOCUMENT_PROCESSOR", "gpt4o")

    processors = {
        "gpt4o": GPT4oProcessor,
        "document_ai": DocumentAIProcessor,
        "mock": MockProcessor,
    }

    cls = processors.get(provider)
    if not cls:
        logger.warning(f"Unknown processor '{provider}', falling back to mock")
        return MockProcessor()

    try:
        return cls()
    except Exception as e:
        logger.error(f"Failed to init {provider} processor: {e}, falling back to mock")
        return MockProcessor()

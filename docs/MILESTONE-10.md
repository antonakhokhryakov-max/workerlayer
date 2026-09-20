# Milestone 10

Ironwharf diligence now includes an **image-only shop-floor scan**. The PDF has no usable text layer.

The worker requests `pdf.ocr`. The control plane allows it only for attached task files. Tesseract reads the page and returns text plus confidence. Low-confidence number-like tokens are dropped — they are not invented. The quality loop still draft-fails, then corrects to a sendable pack with 0 interventions. No new screen.

Harbor, market, and the Ironwharf text-path files stay on the text extractor. They do not go through OCR.

## What you can do

Assign Ironwharf diligence from the desk or `pnpm aether diligence`. The worker opens the scan, requests OCR, flags scan confidence, and still finishes a comparison spreadsheet and a short presentation. Accept with 0 fixes when the loop did its job.

## What this is not

Not a new review button. Not enterprise. OCR quality is limited: a one-letter slip stays a slip unless it matches a vendor already known from text sources. Numbers below the confidence cutoff are omitted.

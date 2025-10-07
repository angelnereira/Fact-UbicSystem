# The Factory HKA Integration Guide

This document outlines the technical implementation and usage of the integration with The Factory HKA API for electronic invoicing.

## 1. Overview

The integration is primarily managed through the `src/lib/hka/client.ts` module. This client handles all direct communication with the HKA API, including authentication, request signing, and automated retries. The rest of the application should use the exported functions from this module rather than `fetch` directly.

## 2. Configuration

All configuration is managed via environment variables. Create a `.env.local` file in the root of the project by copying `.env.example`.

### Environment Variables

-   `NEXT_PUBLIC_HKA_ENV`: Specifies the target environment.
    -   Values: `demo` | `prod`
    -   Default: `demo`
-   `NEXT_PUBLIC_HKA_API_KEY`: Your secret API key for authenticating requests.
-   `NEXT_PUBLIC_HKA_API_BASE_PROD`: The base URL for the HKA production API.
-   `NEXT_PUBLIC_HKA_API_BASE_DEMO`: The base URL for the HKA demo API.

**Example `.env.local`:**

```
NEXT_PUBLIC_HKA_ENV="demo"
NEXT_PUBLIC_HKA_API_KEY="sk_test_your_real_api_key_here"
NEXT_PUBLIC_HKA_API_BASE_PROD="https://api.hka.production.example"
NEXT_PUBLIC_HKA_API_BASE_DEMO="https://api.hka.demo.example"
```

## 3. Core `request` Function

The internal `request` function in `client.ts` is the cornerstone of the integration.

-   **Authentication**: Automatically injects the `Authorization: Bearer ${HKA_API_KEY}` header.
-   **Retries**: Implements an exponential backoff strategy for network errors and 5xx server errors. It will attempt a request up to 3 times (1 initial + 2 retries).
-   **Error Handling**: Wraps all errors in a custom `HkaError` class, which includes the HTTP status, response body, and number of attempts for easier debugging.

## 4. Exported API Functions

The client exposes the following async functions for use throughout the application:

-   `timbrar(payload: object): Promise<HkaResponse>`
    -   Sends an invoice payload to be stamped.
-   `consultarEstado(uuidOrFolio: string): Promise<HkaStatus>`
    -   Retrieves the current status of a given invoice.
-   `anular(uuidOrFolio: string, reason: string): Promise<HkaResponse>`
    -   Submits a cancellation request for an invoice.
-   `consultarFolios(): Promise<number>`
    -   Returns the number of available folios.

## 5. Dashboard Pages

The application includes several dashboard pages to manage and monitor the integration:

-   `/dashboard/movements`: A central hub to view API health, configure data sources, and see a log of recent API interactions.
-   `/dashboard/settings`: A form to configure company details and HKA credentials for both demo and production environments. Includes a "Validate Connection" feature.
-   `/dashboard/invoices/new`: A form for manually creating and submitting an invoice for testing or low-volume scenarios.
-   `/dashboard/invoices/status`: A simple UI to check the status of an invoice by its ID.
-   `/dashboard/invoices/cancel`: A form to submit a cancellation request.
-   `/dashboard/consult/ruc`: A utility to look up taxpayer information by RUC.
-   `/dashboard/test-db`: A diagnostic page to verify the database connection (simulated).

## 6. Local Testing

### Running the Application

1.  Install dependencies: `npm install`
2.  Run the development server: `npm run dev`
3.  The application will be available at `http://localhost:9002`.

### Simulating Webhook Calls

You can simulate an external system sending an invoice to your local webhook endpoint using `curl`.

1.  Create a file named `payload.json` with the following content:
    ```json
    {
      "invoice": {
        "externalId": "1234",
        "customer": { "name": "ACME", "ruc": "123456789" },
        "items": [{ "desc": "Producto A", "qty": 1, "unitPrice": 100 }]
      }
    }
    ```
2.  Run the following `curl` command in your terminal:
    ```bash
    curl -X POST http://localhost:9002/api/webhooks/invoices -H "Content-Type: application/json" -d @payload.json
    ```

This will send the invoice data to the API route that handles incoming webhooks.

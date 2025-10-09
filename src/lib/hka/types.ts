
/**
 * Represents a generic successful response from the HKA API.
 */
export interface HkaResponse {
  success: boolean;
  message: string;
  uuid?: string; // Corresponds to CUFE
  [key: string]: any; // Allow other properties
}

/**
 * Represents the status of a previously stamped invoice.
 */
export interface HkaStatus {
  status: 'stamped' | 'cancelled' | 'processing' | 'error' | 'not_found';
  message: string;
  uuid?: string;
  folio?: string;
  timestamp?: string;
}

/**
 * Custom error class for handling errors from the HKA API.
 */
export class HkaError extends Error {
  status?: number;
  body?: any;
  attempts?: number;

  constructor({
    message,
    status,
    body,
    attempts,
  }: {
    message: string;
    status?: number;
    body?: any;
    attempts?: number;
  }) {
    super(message);
    this.name = 'HkaError';
    this.status = status;
    this.body = body;
    this.attempts = attempts;

    // This is for ensuring the prototype chain is correct
    Object.setPrototypeOf(this, HkaError.prototype);
  }
}

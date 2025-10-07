export type Invoice = {
  id: string;
  customerName: string;
  customerTaxId: string;
  total: number;
  status: "received" | "stamping" | "stamped" | "cancelled" | "error";
  createdAt: Date;
  items: {
    description: string;
    quantity: number;
    price: number;
  }[];
};

export const mockInvoices: Invoice[] = [];

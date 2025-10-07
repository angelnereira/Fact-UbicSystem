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

export const mockInvoices: Invoice[] = [
  {
    id: "INV-2024001",
    customerName: "Tech Solutions Inc.",
    customerTaxId: "TSI123456",
    total: 1500.0,
    status: "stamped",
    createdAt: new Date("2024-07-22T10:00:00Z"),
    items: [{ description: "Cloud Services", quantity: 1, price: 1500.0 }],
  },
  {
    id: "INV-2024002",
    customerName: "Creative Minds Agency",
    customerTaxId: "CMA789012",
    total: 3200.5,
    status: "stamping",
    createdAt: new Date("2024-07-22T11:30:00Z"),
    items: [
      { description: "Web Design Package", quantity: 1, price: 3000.0 },
      { description: "Domain Registration", quantity: 1, price: 200.5 },
    ],
  },
  {
    id: "INV-2024003",
    customerName: "Innovate Labs",
    customerTaxId: "INL345678",
    total: 800.0,
    status: "received",
    createdAt: new Date("2024-07-21T14:00:00Z"),
    items: [{ description: "Prototyping Materials", quantity: 10, price: 80.0 }],
  },
  {
    id: "INV-2024004",
    customerName: "Global Exports LLC",
    customerTaxId: "GEX901234",
    total: 12500.75,
    status: "cancelled",
    createdAt: new Date("2024-07-20T09:00:00Z"),
    items: [{ description: "Shipping Container", quantity: 1, price: 12500.75 }],
  },
  {
    id: "INV-2024005",
    customerName: "Local Foods Co.",
    customerTaxId: "LFC567890",
    total: 450.25,
    status: "error",
    createdAt: new Date("2024-07-19T16:20:00Z"),
    items: [
      { description: "Organic Vegetables", quantity: 20, price: 15.5 },
      { description: "Artisan Bread", quantity: 10, price: 14.025 },
    ],
  },
];

import { Router, Request, Response } from "express";

export const productRoutes = Router();

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

const products: Product[] = [
  { id: 1, name: "Widget", price: 9.99, stock: 100 },
  { id: 2, name: "Gadget", price: 29.99, stock: 50 },
];

productRoutes.get("/", (_req: Request, res: Response) => {
  res.json({ products });
});

productRoutes.post("/", (req: Request, res: Response) => {
  // No input validation
  const { name, price, stock } = req.body;
  const product: Product = {
    id: products.length + 1,
    name,
    price: parseFloat(price),
    stock: parseInt(stock),
  };
  products.push(product);
  res.status(201).json({ product });
});

import { Router, Request, Response } from "express";

export const userRoutes = Router();

interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
}

const users: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com", age: 30 },
  { id: 2, name: "Bob", email: "bob@example.com" },
];

userRoutes.get("/", (req: Request, res: Response) => {
  res.json({ users });
});

userRoutes.get("/:id", (req: Request, res: Response) => {
  const user = users.find((u) => u.id === parseInt(req.params.id));
  // Bug: missing null check — good eval target
  res.json({ user: user });
});

userRoutes.post("/", (req: Request, res: Response) => {
  const { name, email, age } = req.body;

  // Missing validation — good eval target
  const newUser: User = {
    id: users.length + 1,
    name,
    email,
    age,
  };

  users.push(newUser);
  res.status(201).json({ user: newUser });
});

userRoutes.delete("/:id", (req: Request, res: Response) => {
  const idx = users.findIndex((u) => u.id === parseInt(req.params.id));
  if (idx === -1) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  users.splice(idx, 1);
  res.json({ message: "Deleted" });
});

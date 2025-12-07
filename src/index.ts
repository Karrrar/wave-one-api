import express, { Request, Response } from "express";
import cors from "cors";
import Database from "better-sqlite3";
import path from "path";

// -----------------------------------------------------
// DATABASE SETUP
// -----------------------------------------------------
const db = new Database(path.join(process.cwd(), "foods.db"));

// Create table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image TEXT NOT NULL,
    price INTEGER NOT NULL
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(food_id) REFERENCES foods(id)
  )
`).run();

// Seed database if empty
const row = db.prepare("SELECT COUNT(*) AS c FROM foods").get() as { c: number };

if (row.c === 0) {
  const foods = [
    { name: "Pizza", image: "img/pizza.png", price: 16000 },
    { name: "Burger", image: "img/burger.png", price: 3500 },
    { name: "Quzi", image: "img/quzi.png", price: 25000 },
    { name: "Pasta", image: "img/pasta.png", price: 18000 },
    { name: "Salad", image: "img/salad.png", price: 7000 },
    { name: "Dolma", image: "img/dolma.png", price: 25000 },
  ];

  const stmt = db.prepare(
    "INSERT INTO foods (name, image, price) VALUES (?, ?, ?)"
  );

  foods.forEach(f => stmt.run(f.name, f.image, f.price));

  console.log("Database seeded with default foods.");
}

// -----------------------------------------------------
// EXPRESS SETUP
// -----------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------
// ROUTES
// -----------------------------------------------------

// Get all foods
app.get("/foods", (req: Request, res: Response) => {
  const foods = db.prepare("SELECT * FROM foods").all();
  res.json(foods);
});

// Add a new food
app.post("/foods", (req: Request, res: Response) => {
  const { name, image, price } = req.body;

  if (!name || !image || !price) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const stmt = db.prepare(
    "INSERT INTO foods (name, image, price) VALUES (?, ?, ?)"
  );

  const result = stmt.run(name, image, price);

  res.json({
    id: result.lastInsertRowid,
    name,
    image,
    price,
  });
});


app.get("/favorites", (req: Request, res: Response) => {
  const favorites = db.prepare(`
    SELECT f.id, f.qty, foods.name, foods.image, foods.price
    FROM favorites f
    JOIN foods ON f.food_id = foods.id
  `).all();

  res.json(favorites);
});


app.post("/favorites", (req: Request, res: Response) => {
  const { food_id } = req.body;

  // Check if already exists
  const existing = db.prepare("SELECT * FROM favorites WHERE food_id = ?").get(food_id);

  if (existing) {
    const stmt = db.prepare("UPDATE favorites SET qty = qty + 1 WHERE food_id = ?");
    stmt.run(food_id);

    const updated = db.prepare("SELECT * FROM favorites WHERE food_id = ?").get(food_id);
    return res.json(updated);
  }

  const stmt = db.prepare("INSERT INTO favorites (food_id, qty) VALUES (?, 1)");
  const result = stmt.run(food_id);

  const favorite = db.prepare("SELECT * FROM favorites WHERE id = ?").get(result.lastInsertRowid);
  res.json(favorite);
});



app.patch("/favorites/:id", (req: Request, res: Response) => {
  const { qty } = req.body;

  if (!qty || qty < 1) {
    return res.status(400).json({ error: "qty must be >= 1" });
  }

  const stmt = db.prepare("UPDATE favorites SET qty = ? WHERE id = ?");
  stmt.run(qty, req.params.id);

  const updated = db.prepare("SELECT * FROM favorites WHERE id = ?").get(req.params.id);

  res.json(updated);
});


app.delete("/favorites/:id", (req: Request, res: Response) => {
  db.prepare("DELETE FROM favorites WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});


// -----------------------------------------------------
// START SERVER
// -----------------------------------------------------
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});

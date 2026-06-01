import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Тимчасова база даних користувачів у пам'яті
const users = [
    { id: 1, username: 'player1', password: 'password123', balance: 5000.0 }
];

// Ендпоінт реєстрації
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Користувач вже існує' });
    }
    const newUser = { id: users.length + 1, username, password, balance: 1000.0 };
    users.push(newUser);
    res.status(201).json({ id: newUser.id, username: newUser.username, balance: newUser.balance });
});

// Ендпоінт логіну
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Невірні дані користувача' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
        access_token: token,
        token_type: 'bearer',
        user: { id: user.id, username: user.username, balance: user.balance }
    });
});

app.listen(PORT, () => {
    console.log(`Auth Service працює на порту ${PORT}`);
});
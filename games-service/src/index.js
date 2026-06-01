import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5002;

// Ендпоінт для гри Dice (Кубики)
app.post('/dice/bet', (req, res) => {
    const { betAmount, targetMultiplier, condition } = req.body;

    // Перевірка авторизації (в реальності тут має перевірятися токен або йти запит до auth-service)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Логіка генерації випадкового числа від 0.01 до 99.99
    const rollResult = parseFloat((Math.random() * 99.98 + 0.01).toFixed(2));
    let win = false;

    // Визначення математичного шансу виграшу
    const winChance = 99.0 / targetMultiplier;

    if (condition === 'over' && rollResult > (100 - winChance)) {
        win = true;
    } else if (condition === 'under' && rollResult < winChance) {
        win = true;
    }

    const payout = win ? betAmount * targetMultiplier : 0;

    res.json({
        roll: rollResult,
        win,
        payout,
        newBalance: 4500.0 + payout - betAmount // Заглушка для демонстрації зміни балансу
    });
});

app.listen(PORT, () => {
    console.log(`Games Service працює на порту ${PORT}`);
});
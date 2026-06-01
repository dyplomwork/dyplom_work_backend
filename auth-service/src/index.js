import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// Створюємо окремий роутер для акаунтів
const accountsRouter = express.Router();

accountsRouter.post('/auth/register', (req, res) => {
    // логіка реєстрації
    res.status(201).json({ ok: true, token: 'jwt_token', user: { id: '1', nickname: req.body.nickname, balance: 1000 } });
});

accountsRouter.post('/auth/login', (req, res) => {
    // логіка логіну
    res.json({ ok: true, token: 'jwt_token', user: { id: '1', nickname: 'Test', balance: 1000 } });
});

accountsRouter.post('/logout', (req, res) => {
    res.json({ ok: true });
});

accountsRouter.get('/users/me', (req, res) => {
    res.json({ ok: true, user: { id: '1', nickname: 'Test', balance: 1000 } });
});

accountsRouter.get('/users/me/balance', (req, res) => {
    res.json({ ok: true, balance: 1000 });
});

// Підключаємо роутер до головного шляху, який очікує фронтенд
app.use('/api/v1/accounts', accountsRouter);

// Окремий роут для застосування балансу (бо він не в /accounts/)
app.post('/api/balance/apply', (req, res) => {
    const { delta } = req.body;
    // логіка зміни балансу
    res.json({ ok: true, balance: 1000 + delta });
});

app.listen(5001, () => console.log('Auth Service is running'));
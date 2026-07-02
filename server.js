const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');
const path = require('path');
const app = express();
const users = {};

// ================================================
// БЛОК 1: Базовая настройка сервера
// ================================================
app.use(express.json());
app.use(cors());

// ================================================
// БЛОК 2: Steam-авторизация
// ================================================
// Отправляет пользователя в Steam для входа
app.get('/api/steam-auth', (req, res) => {
    const steamLoginUrl = `https://steamcommunity.com/openid/login?` +
        `openid.ns=http://specs.openid.net/auth/2.0&` +
        `openid.identity=http://specs.openid.net/auth/2.0/identifier_select&` +
        `openid.return_to=https://sandmoney-server.onrender.com/api/steam-callback&` +
        `openid.realm=https://sandmoney-server.onrender.com&` +
        `openid.mode=checkid_setup`;
    res.redirect(steamLoginUrl);
});

app.get('/api/steam-callback', (req, res) => {
    console.log('Steam callback received. Full query:', req.query);
    console.log('Steam callback received. Full params:', req.params);

    const claimedId = req.query['openid_claimed_id'];
    console.log('Claimed ID:', claimedId);

    let steamId = null;

    if (claimedId) {
        steamId = claimedId.split('/').pop();
    } else {
        console.log('No claimedId found, checking other keys...');
        const identity = req.query['openid.identity'];
        console.log('openid.identity:', identity);
        if (identity) {
            steamId = identity.split('/').pop();
        }
    }

    if (!steamId) {
        return res.send('Ошибка входа. Попробуйте снова.');
    }

    // Сохраняем пользователя
    users[steamId] = {
        steamId: steamId,
        name: `Steam User ${steamId.slice(-6)}`,
        balance: 0,
        transactions: []
    };

    res.send(`
        <h1>✅ Вход выполнен успешно!</h1>
        <p>Ваш Steam ID: ${steamId}</p>
        <p>Имя: ${users[steamId].name}</p>
        <a href="/">Вернуться на главную</a>
    `);
});

// ================================================
// БЛОК 3: Ключи для T‑Банка (пока из переменных окружения)
// ================================================
const TERMINAL_KEY = process.env.TERMINAL_KEY;
const PASSWORD = process.env.PASSWORD;

// ================================================
// БЛОК 4: Создание платежа
// ================================================
app.post('/create-payment', async (req, res) => {
  const { productId, amount } = req.body;
  console.log(`Creating payment for ${productId}, amount ${amount}`);
  const orderId = crypto.randomUUID();
  const data = {
    TerminalKey: TERMINAL_KEY,
    Amount: amount * 100,
    OrderId: orderId,
    Description: `Покупка ${productId}`,
    SuccessURL: 'https://твой-сервер-на-render.com/success',
    FailURL: 'https://твой-сервер-на-render.com/fail',
    NotificationURL: 'https://твой-сервер-на-render.com/webhook'
  };

  // ================================================
  // ВЛОЖЕННЫЙ БЛОК: Генерация токена
  // ================================================
  function generateToken(data, password) {
    const params = { ...data };
    delete params.Token;

    const sortedKeys = Object.keys(params).sort();
    const tokenString = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const tokenWithPassword = `${tokenString}${password}`;
    const hash = crypto.createHash('sha256');
    hash.update(tokenWithPassword);
    return hash.digest('hex').toLowerCase();
  }

  const token = generateToken(data, PASSWORD);
  data.Token = token;

  // ================================================
  // ВЛОЖЕННЫЙ БЛОК: Запрос к T‑Банку
  // ================================================
  try {
    const response = await axios.post('https://securepay.tinkoff.ru/v2/Init', data);
    console.log('T-Bank response:', response.data);

    if (response.data && response.data.PaymentURL) {
      res.json({
        success: true,
        paymentUrl: response.data.PaymentURL,
        orderId: orderId
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Не удалось создать платеж'
      });
    }
  } catch (error) {
    console.error('T-Bank error:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// ================================================
// БЛОК 5: Вебхук от T‑Банка
// ================================================
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.status(200).send('OK');
});

// ================================================
// БЛОК 6: Проверка здоровья сервера
// ================================================
app.get('/health', (req, res) => {
  res.status(200).send('Server is running');
});

// ================================================
// БЛОК 7: Статические файлы (HTML, CSS, JS)
// ================================================
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'site.html'));
});

// ================================================
// БЛОК 8: Запуск сервера
// ================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`S&Money server running on port ${PORT}`);
});

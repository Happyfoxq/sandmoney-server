const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// --- ЗДЕСЬ ТВОИ КЛЮЧИ (на время теста) ---
// В боевом варианте они должны быть в переменных окружения!
const TERMINAL_KEY = process.env.TERMINAL_KEY;;
const PASSWORD = process.env.PASSWORD;';
// ---
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

function generateToken(data, password) {
  // 1. Создаём копию объекта, исключаем Token, TerminalKey и другие служебные поля
  const params = { ...data };
  // Если вдруг Token уже есть, удаляем его
  delete params.Token;

  // 2. Сортируем ключи в алфавитном порядке
  const sortedKeys = Object.keys(params).sort();

  // 3. Собираем строку вида key=value&key2=value2
  const tokenString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // 4. Добавляем пароль в конец
  const tokenWithPassword = `${tokenString}${password}`;

  // 5. Вычисляем SHA-256 и приводим к нижнему регистру
  const hash = crypto.createHash('sha256');
  hash.update(tokenWithPassword);
  return hash.digest('hex').toLowerCase();
}
const token = generateToken(data, PASSWORD);
data.Token = token;
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
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.status(200).send('OK');
});
app.get('/health', (req, res) => {
  res.status(200).send('Server is running');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`S&Money server running on port ${PORT}`);
});

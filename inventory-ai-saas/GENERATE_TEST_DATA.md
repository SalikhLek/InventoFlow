# Генерация тестовых данных для предсказания трат товаров

## Проблема
Для работы предсказания трат товаров (forecast) необходимо иметь историю продаж в поле `sales_history` каждого товара. Без этих данных система не может делать точные прогнозы.

## Как это работает

Предсказание использует данные из поля `sales_history`, которое должно содержать массив объектов вида:
```json
[
  {"date": "2024-01-01", "sales": 10},
  {"date": "2024-01-02", "sales": 15},
  {"date": "2024-01-03", "sales": 12},
  ...
]
```

## Способы генерации данных

### Способ 1: Через API (продажи товаров)

Когда вы продаете товар через интерфейс (кнопка "Продать"), система автоматически добавляет запись в `sales_history`. 

**Пример:**
1. Откройте товар в списке
2. Нажмите "..." → "Продать"
3. Укажите количество и дату продажи
4. Система автоматически добавит эту продажу в историю

### Способ 2: Прямое обновление через API

Вы можете обновить `sales_history` напрямую через API:

```bash
# Получить токен авторизации (через /auth/login)
TOKEN="your_token_here"
ITEM_ID=1

# Обновить sales_history
curl -X PUT "http://localhost:8000/items/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sales_history": [
      {"date": "2024-01-01", "sales": 10},
      {"date": "2024-01-02", "sales": 15},
      {"date": "2024-01-03", "sales": 12},
      {"date": "2024-01-04", "sales": 18},
      {"date": "2024-01-05", "sales": 14}
    ]
  }'
```

### Способ 3: Использование Python скрипта

Создайте файл `generate_test_data.py`:

```python
import requests
import json
from datetime import datetime, timedelta
import random

# Настройки
API_URL = "http://localhost:8000"
USERNAME = "your_username"
PASSWORD = "your_password"

# Авторизация
login_response = requests.post(
    f"{API_URL}/auth/login",
    json={"username": USERNAME, "password": PASSWORD}
)
token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Получить список товаров
items_response = requests.get(f"{API_URL}/items/", headers=headers)
items = items_response.json()

# Генерировать историю продаж для каждого товара
for item in items:
    # Генерировать данные за последние 30 дней
    sales_history = []
    base_date = datetime.now() - timedelta(days=30)
    
    for i in range(30):
        date = base_date + timedelta(days=i)
        # Генерировать случайные продажи (от 5 до 25 единиц)
        sales = random.randint(5, 25)
        sales_history.append({
            "date": date.strftime("%Y-%m-%d"),
            "sales": sales
        })
    
    # Обновить товар
    update_response = requests.put(
        f"{API_URL}/items/{item['id']}",
        headers=headers,
        json={
            "sales_history": sales_history
        }
    )
    
    if update_response.status_code == 200:
        print(f"✓ Обновлен товар: {item['name']}")
    else:
        print(f"✗ Ошибка обновления {item['name']}: {update_response.text}")
```

Запустите скрипт:
```bash
pip install requests
python generate_test_data.py
```

## Рекомендации

1. **Минимум данных**: Для работы предсказания нужно хотя бы 3-5 записей в истории продаж
2. **Регулярность**: Данные должны быть регулярными (ежедневные продажи дают лучший результат)
3. **Реалистичность**: Чем больше данных, тем точнее прогноз
4. **Даты**: Используйте реальные даты в формате YYYY-MM-DD

## Проверка работы

После генерации данных:
1. Откройте страницу товара (`/items/{id}`)
2. Нажмите "Получить прогноз"
3. Выберите количество дней и метод
4. Убедитесь, что прогноз отображается корректно

## Методы предсказания

- **auto**: Автоматически выбирает лучший доступный метод
- **prophet**: Facebook Prophet (требует установки `prophet`)
- **arima**: ARIMA модель (требует минимум 3 записи)
- **mean**: Простое среднее значение (работает всегда, но менее точно)

## Примечание

Если у товара нет истории продаж, система вернет прогноз из нулей. Это нормальное поведение - система не может предсказать спрос без исторических данных.


# Инструкция по запуску сайта

Ваш проект состоит из двух частей:
- **Backend** (FastAPI) - работает на порту 8000
- **Frontend** (React) - работает на порту 3000

## Шаг 1: Запуск Backend

Откройте первый терминал и выполните:

```bash
cd inventory-ai-saas
source .venv/bin/activate
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend запустится на: http://localhost:8000
Документация API доступна на: http://localhost:8000/docs

**Флаг `--reload`** автоматически перезагружает сервер при изменении кода (удобно для разработки).

## Шаг 2: Запуск Frontend

Откройте второй терминал и выполните:

```bash
cd inventory-ai-saas/frontend
npm start
```

Frontend автоматически откроется в браузере на: http://localhost:3000

## Примечания

- Убедитесь, что Python 3 и Node.js установлены
- Если зависимости не установлены:
  - Backend: `pip install -r requirements.txt` (из папки `inventory-ai-saas/`, с активированным `.venv`)
  - Frontend: `npm install` (в папке `frontend/`)

## Остановка серверов

- Нажмите `Ctrl+C` в каждом терминале, чтобы остановить соответствующий сервер

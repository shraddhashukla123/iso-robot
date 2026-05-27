# ISO Robot AI Backend

Production-ready Python backend template — plug in any business.

## Stack
- **Framework**: FastAPI (async)
- **Database**: PostgreSQL (async via SQLAlchemy)
- **LLM**: Anthropic Claude / OpenAI (switchable via `.env`)
- **Auth**: JWT (access + refresh tokens)
- **Cache / Queue**: Redis
- **Vector DB**: Qdrant

## Folder Structure
```
iso-robot-backend/
├── main.py                        # Entry point
├── app/
│   ├── api/v1/
│   │   ├── router.py              # Master router — wires all endpoints
│   │   └── endpoints/
│   │       ├── health.py          # GET /health
│   │       ├── auth.py            # POST /auth/register, /auth/login
│   │       ├── users.py           # CRUD /users
│   │       ├── business.py        # Business setup
│   │       ├── controls.py        # AI control extraction
│   │       ├── issues.py          # AI issue classification
│   │       ├── risks.py           # AI risk scoring + expansion
│   │       └── documents.py       # File upload
│   ├── core/
│   │   ├── config.py              # All settings from .env
│   │   ├── logger.py              # Structured logging
│   │   ├── security.py            # JWT, password hashing
│   │   └── dependencies.py        # FastAPI dependency injection
│   ├── db/
│   │   ├── session.py             # Async DB engine + session
│   │   └── base_model.py          # Shared base with timestamps
│   ├── handlers/
│   │   └── error_handler.py       # Centralised error responses
│   ├── middleware/
│   │   ├── request_logger.py      # Logs every request + response time
│   │   └── error_handler.py       # Catches unhandled exceptions
│   ├── models/
│   │   ├── user.py                # User ORM model
│   │   └── business.py            # Business ORM model
│   ├── schemas/
│   │   ├── user_schema.py         # Pydantic schemas for users
│   │   └── common_schema.py       # SuccessResponse, PaginatedResponse
│   ├── services/
│   │   ├── llm_service.py         # LLM abstraction (Anthropic / OpenAI)
│   │   └── user_service.py        # User DB operations
│   └── utils/
│       ├── pagination.py          # Paginate any list
│       └── file_handler.py        # Upload + read PDF/DOCX/TXT
├── tests/
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── .gitignore
```

## Quick Start

```bash
# 1. Clone and enter
git clone <your-repo-url>
cd iso-robot-backend

# 2. Create virtual environment
python -m venv .venv
source .venv/bin/activate      # Mac/Linux
.venv\Scripts\activate         # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment
cp .env.example .env
# Edit .env — add your DB URL and LLM API key

# 5. Run with Docker (easiest)
docker-compose up -d

# OR run locally
uvicorn main:app --reload
```

## API Docs
Once running: http://localhost:8000/api/v1/docs

## Environment Variables
See `.env.example` for all options.
Key ones to set: `DATABASE_URL`, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, `SECRET_KEY`.

## Adding a New Business Module
1. Add model in `app/models/`
2. Add schema in `app/schemas/`
3. Add service in `app/services/`
4. Add endpoint in `app/api/v1/endpoints/`
5. Register in `app/api/v1/router.py`

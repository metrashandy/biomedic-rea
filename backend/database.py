from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Ini akan otomatis bikin file medis.db di folder yang sama
SQLALCHEMY_DATABASE_URL = "sqlite:///./medis.db"

# check_same_thread=False wajib untuk SQLite di FastAPI
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
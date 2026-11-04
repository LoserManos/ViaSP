"""Configurações da aplicação, lidas de variáveis de ambiente / arquivo .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # SPTrans (Olho Vivo)
    sptrans_token: str = ""
    sptrans_base_url: str = "https://api.olhovivo.sptrans.com.br/v2.1"
    sptrans_timeout_segundos: float = 10.0

    # Cache em memória e proteção da API externa (ISS-11)
    cache_ttl_linhas_segundos: float = 60.0
    cache_ttl_paradas_segundos: float = 3600.0
    cache_ttl_previsoes_segundos: float = 15.0

    # Totem / parada configurada
    totem_identificador: str = "totem-001"
    parada_codigo: int = 0

    # GTFS da SPTrans (pasta ou .zip com stops.txt): nome e coordenadas de todas as paradas
    gtfs_caminho: str = "data/gtfs"

    # Rotas /api/dev (escolher a parada num mapa). Ligado por `python -m app --dev`, não pelo .env
    modo_dev: bool = False

    # Persistência
    banco_caminho: str = "data/totem.db"

    # Frontend
    cors_origens: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()

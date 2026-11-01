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

    # Totem / parada configurada
    totem_identificador: str = "totem-001"
    parada_codigo: int = 0
    # Usados quando a SPTrans não devolve os dados da parada (ex.: paradas sem nome no cadastro)
    parada_nome: str = ""
    parada_endereco: str = ""
    parada_latitude: float = 0.0
    parada_longitude: float = 0.0

    # Persistência
    banco_caminho: str = "data/totem.db"

    # Frontend
    cors_origens: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()

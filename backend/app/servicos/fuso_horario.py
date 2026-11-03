"""Utilitários de data e fuso horário para a aplicação."""
from datetime import datetime, timedelta, timezone

FUSO_SP_FALLBACK = timezone(timedelta(hours=-3))


def agora_sao_paulo() -> datetime:
    """Retorna o datetime atual no fuso de São Paulo (America/Sao_Paulo).

    Faz fallback seguro para UTC-3 caso a base IANA (tzdata) não esteja
    disponível no sistema operacional (comum no Windows sem tzdata).
    """
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("America/Sao_Paulo"))
    except Exception:
        return datetime.now(FUSO_SP_FALLBACK)

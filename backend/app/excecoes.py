"""Exceções de domínio. Mapeadas para respostas HTTP em app/main.py (US08)."""


class ErroSPTrans(Exception):
    """Erro genérico na comunicação com a API Olho Vivo."""


class ErroAutenticacaoSPTrans(ErroSPTrans):
    """Token inválido/ausente ou falha ao autenticar."""


class SPTransIndisponivel(ErroSPTrans):
    """Timeout, erro de rede ou API fora do ar."""

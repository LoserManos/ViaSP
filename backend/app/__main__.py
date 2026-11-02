"""Sobe o backend: `python -m app` (totem) ou `python -m app --dev` (demonstração).

`--dev` libera as rotas /api/dev (escolher a parada do totem num mapa) e
recarrega o servidor quando o código muda. Rode de dentro de `backend/`, onde
ficam o `.env`, o banco e o GTFS.
"""
import argparse
import os

import uvicorn


def main(argumentos: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app", description="Backend do totem ViaSP")
    parser.add_argument(
        "--dev", action="store_true", help="modo de desenvolvimento: rotas /api/dev e recarga automática"
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--porta", type=int, default=8000)
    opcoes = parser.parse_args(argumentos)

    # A recarga roda o app em outro processo, que herda esta variável
    os.environ["MODO_DEV"] = "true" if opcoes.dev else "false"
    uvicorn.run(
        "app.main:app",
        host=opcoes.host,
        port=opcoes.porta,
        reload=opcoes.dev,
        reload_dirs=["app"] if opcoes.dev else None,
    )


if __name__ == "__main__":
    main()

"""Normaliza e analisa a telemetria do Labirinto das Cores com Pandas.

Uso:
    python scripts/analisar_telemetria.py
    python scripts/analisar_telemetria.py --usuario AloofMule9877
    python scripts/analisar_telemetria.py --saida-json data/relatorio_telemetria.json
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "dadosTCC.txt"
DEFAULT_OUTPUT = ROOT / "data" / "relatorio_telemetria.json"
HEADER_MARKER = "UserId"
MIN_COLUMNS = 15
FIRST_ROOM_COLUMN = 12


def parse_number(value: str) -> float:
    """Converte números do log, aceitando percentuais e vírgula decimal."""
    normalized = value.strip().replace("%", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return 0.0


def extract_trajectory(value: str) -> list[dict[str, float]]:
    """Extrai pontos válidos do JSON de trajetória, mesmo com prefixos do Roblox."""
    start = value.find("[")
    end = value.rfind("]")
    if start == -1 or end <= start:
        return []

    try:
        parsed = json.loads(value[start : end + 1])
    except json.JSONDecodeError:
        return []

    if not isinstance(parsed, list):
        return []

    return [
        {"x": float(point["x"]), "z": float(point["z"])}
        for point in parsed
        if isinstance(point, dict)
        and _is_number(point.get("x"))
        and _is_number(point.get("z"))
    ]


def _is_number(value: Any) -> bool:
    try:
        float(value)
    except (TypeError, ValueError):
        return False
    return True


def classify_model(completed_rooms: int, room_times: dict[str, float], trajectory: list[Any]) -> str | None:
    if not trajectory and completed_rooms == 0:
        return "12_Salas"
    if 10 <= completed_rooms <= 12 and room_times.get("Sala_13", 0) == 0:
        return "12_Salas"
    if 20 <= completed_rooms <= 24:
        return "24_Salas"
    return None


def parse_line(line: str) -> dict[str, Any] | None:
    columns = [column.strip() for column in line.strip().split(";")]
    if len(columns) < MIN_COLUMNS or HEADER_MARKER in columns[1]:
        return None

    name = re.split(r"\s+", columns[0])[-1]
    if not name or not columns[1]:
        return None

    trajectory_index = len(columns) - 2
    trajectory = extract_trajectory(columns[trajectory_index])
    room_times = {
        f"Sala_{index - FIRST_ROOM_COLUMN + 1:02d}": parse_number(columns[index])
        for index in range(FIRST_ROOM_COLUMN, trajectory_index)
    }
    completed_rooms = sum(value > 0 for value in room_times.values())
    model = classify_model(completed_rooms, room_times, trajectory)
    if model is None:
        return None

    if model == "12_Salas":
        room_times = {
            room: value
            for room, value in room_times.items()
            if int(room.removeprefix("Sala_")) <= 12
        }

    return {
        "nome": name,
        "id": columns[1],
        "diagnostico": columns[2],
        "tipo": columns[3],
        "certeza": parse_number(columns[4]),
        "pctNormal": parse_number(columns[5]),
        "pctLeve": parse_number(columns[6]),
        "pctMod": parse_number(columns[7]),
        "pctSev": parse_number(columns[8]),
        "pctConsistencia": parse_number(columns[9]),
        "tempoTotal": parse_number(columns[11]),
        "data": columns[-1].split(" - ")[0].strip(),
        "versao": model,
        "qtdSalas": completed_rooms,
        "tempos": room_times,
        "trajeto": trajectory,
    }


def carregar_telemetria(path: Path) -> pd.DataFrame:
    records = []
    with path.open(encoding="utf-8-sig") as file:
        for line in file:
            record = parse_line(line)
            if record is not None:
                records.append(record)

    if not records:
        raise ValueError(f"Nenhuma sessão válida encontrada em {path}.")

    frame = pd.DataFrame(records)
    frame["tempo_total_calculado"] = frame["tempos"].map(
        lambda tempos: sum(tempos.values())
    )
    return frame


def gerar_relatorio(frame: pd.DataFrame, usuario: str | None = None) -> dict[str, Any]:
    selecionados = frame
    if usuario:
        selecionados = frame[
            frame["nome"].str.casefold() == usuario.strip().casefold()
        ]
        if selecionados.empty:
            raise ValueError(f"Usuário não encontrado: {usuario}")

    tempos = selecionados["tempo_total_calculado"]
    diagnosticos = selecionados["diagnostico"]
    return {
        "filtros": {"usuario": usuario},
        "kpis": {
            "testes_validos": int(len(selecionados)),
            "tempo_medio_segundos": round(float(tempos.mean()), 2),
            "casos_suspeitos": int((diagnosticos != "Visão Normal").sum()),
            "sessoes_inconsistentes": int(
                ((diagnosticos == "INCONSISTENTE")
                 | (selecionados["pctConsistencia"] < 50)).sum()
            ),
        },
        "por_modelo": (
            selecionados.groupby("versao", dropna=False)
            .size()
            .rename("testes")
            .to_dict()
        ),
        "por_usuario": (
            selecionados.groupby("nome", dropna=False)
            .agg(
                testes=("nome", "size"),
                tempo_medio_segundos=("tempo_total_calculado", "mean"),
                consistencia_media=("pctConsistencia", "mean"),
            )
            .round(2)
            .reset_index()
            .to_dict(orient="records")
        ),
        "sessoes": selecionados.drop(columns=["tempo_total_calculado"]).to_dict(
            orient="records"
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entrada", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--saida-json", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--saida-csv", type=Path)
    parser.add_argument("--usuario")
    args = parser.parse_args()

    frame = carregar_telemetria(args.entrada)
    relatorio = gerar_relatorio(frame, args.usuario)
    args.saida_json.parent.mkdir(parents=True, exist_ok=True)
    args.saida_json.write_text(
        json.dumps(relatorio, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    if args.saida_csv:
        csv_frame = frame.drop(columns=["tempos", "trajeto"])
        args.saida_csv.parent.mkdir(parents=True, exist_ok=True)
        csv_frame.to_csv(args.saida_csv, index=False, encoding="utf-8-sig")

    print(
        f"{relatorio['kpis']['testes_validos']} sessões analisadas. "
        f"Relatório salvo em {args.saida_json}."
    )


if __name__ == "__main__":
    main()
